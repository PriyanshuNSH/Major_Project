-- ============================================================================
-- HealthSync AI — Staging Roles, Pre-State Snapshot & Least-Privilege Grants
-- Engine: Neon PostgreSQL 18.6
-- Usage: psql --variable=ON_ERROR_STOP=1 --single-transaction -f staging_roles_and_permissions.sql
-- ============================================================================

\set ON_ERROR_STOP on

-- 1. Pre-Flight Verification: Target Schema & Tables Must Exist
DO $$
DECLARE
    v_missing text;
BEGIN
    SELECT string_agg(t, ', ') INTO v_missing
    FROM unnest(ARRAY['health_modules', 'users', 'user_profiles', 'assessments', 'assessment_reports', 'refresh_tokens', 'audit_logs']) AS t
    WHERE NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = t
    );

    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'Pre-flight check failed: Required application tables missing from public schema: %', v_missing;
    END IF;
END $$;

-- 2. Pre-Flight Verification: Prevent Manifest Collision or Adoption
-- Abort immediately if _healthsync_staging_manifest already exists (even if empty)
-- to ensure we never adopt or later drop a pre-existing manifest table.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = '_healthsync_staging_manifest'
    ) THEN
        RAISE EXCEPTION 'Pre-flight check failed: Table public._healthsync_staging_manifest already exists (even if empty). Aborting deployment to prevent collision, adoption, or inadvertent deletion of a pre-existing table. Investigate or remove the existing table before deploying.';
    END IF;
END $$;

-- 3. Pre-Flight Verification: Validate Attributes of Pre-Existing Managed Roles & Test Runner
-- If safe restoration of pre-existing role attributes cannot be guaranteed, abort before mutation.
-- Incompatible or elevated shared role attributes must be rejected rather than silently normalized.
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Validate pre-existing shared managed roles (anon, authenticated, service_role)
    FOR r IN 
        SELECT rolname, rolsuper, rolbypassrls, rolcanlogin, rolinherit, rolcreaterole, rolcreatedb, rolreplication, rolconnlimit
        FROM pg_roles 
        WHERE rolname IN ('anon', 'authenticated', 'service_role') 
    LOOP
        IF r.rolcanlogin IS TRUE THEN
            RAISE EXCEPTION 'Security invariant failed: Pre-existing managed role % has rolcanlogin=true (expected NOLOGIN). Shared managed roles must not allow direct TCP logins. Incompatible role configuration detected. Aborting deployment before mutation.', r.rolname;
        END IF;
        IF r.rolsuper IS TRUE THEN
            RAISE EXCEPTION 'Security invariant failed: Pre-existing managed role % has rolsuper=true (expected NOSUPERUSER). Elevated privileges violate least-privilege security model. Aborting deployment before mutation.', r.rolname;
        END IF;
        IF r.rolcreatedb IS TRUE THEN
            RAISE EXCEPTION 'Security invariant failed: Pre-existing managed role % has rolcreatedb=true (expected NOCREATEDB). Aborting deployment before mutation.', r.rolname;
        END IF;
        IF r.rolcreaterole IS TRUE THEN
            RAISE EXCEPTION 'Security invariant failed: Pre-existing managed role % has rolcreaterole=true (expected NOCREATEROLE). Managed roles must not manage other database roles. Aborting deployment before mutation.', r.rolname;
        END IF;
        IF r.rolreplication IS TRUE THEN
            RAISE EXCEPTION 'Security invariant failed: Pre-existing managed role % has rolreplication=true (expected NOREPLICATION). Aborting deployment before mutation.', r.rolname;
        END IF;
        IF r.rolbypassrls IS TRUE THEN
            RAISE EXCEPTION 'Security invariant failed: Pre-existing managed role % has rolbypassrls=true (expected NOBYPASSRLS). Managed roles must not bypass Row Level Security. Aborting deployment before mutation.', r.rolname;
        END IF;
        IF r.rolinherit IS TRUE THEN
            RAISE EXCEPTION 'Security invariant failed: Pre-existing managed role % has rolinherit=true (expected NOINHERIT). Shared managed roles must not automatically inherit other roles. Incompatible configuration. Aborting deployment before mutation.', r.rolname;
        END IF;
        IF r.rolconnlimit <> -1 THEN
            RAISE EXCEPTION 'Security invariant failed: Pre-existing managed role % has non-standard connection limit % (expected -1 for NOLOGIN role). Incompatible role configuration detected. Aborting deployment before mutation.', r.rolname, r.rolconnlimit;
        END IF;
    END LOOP;

    -- Validate healthsync_test_runner if it already exists
    FOR r IN 
        SELECT rolname, rolsuper, rolbypassrls, rolinherit, rolcreaterole, rolcreatedb, rolreplication, rolcanlogin, rolconnlimit
        FROM pg_roles 
        WHERE rolname = 'healthsync_test_runner' 
    LOOP
        IF r.rolsuper IS TRUE OR r.rolbypassrls IS TRUE OR r.rolcreaterole IS TRUE OR r.rolcreatedb IS TRUE OR r.rolreplication IS TRUE THEN
            RAISE EXCEPTION 'Security invariant failed: Pre-existing healthsync_test_runner has elevated privileges (super/bypass/create/replication). Safe restoration cannot be guaranteed. Aborting deployment.';
        END IF;
        IF r.rolcanlogin IS FALSE THEN
            RAISE EXCEPTION 'Security invariant failed: Pre-existing healthsync_test_runner is NOLOGIN. Modifying its login capability cannot be guaranteed safe for rollback. Aborting deployment.';
        END IF;
        IF r.rolinherit IS TRUE THEN
            RAISE EXCEPTION 'Security invariant failed: Pre-existing healthsync_test_runner has rolinherit=true (expected NOINHERIT). Automatic role inheritance breaks isolated SET ROLE security testing. Aborting deployment.';
        END IF;
        IF r.rolconnlimit = 0 THEN
            RAISE EXCEPTION 'Security invariant failed: Pre-existing healthsync_test_runner has connection limit 0. Cannot establish database connection for tests. Aborting deployment.';
        END IF;
    END LOOP;
END $$;

-- 4. Pre-Flight Verification: Strict ACL & Role Membership Invariants
-- LIMITATION DOCUMENTATION:
-- PostgreSQL standard GRANT statements execute under the current session user (grantor).
-- Recreating grants/memberships from a non-owner/non-session grantor cannot be safely
-- guaranteed without altering grantor identity.
-- Therefore:
-- 1) Pre-flight strictly verifies that every pre-existing grant on target tables,
--    columns, and schema has grantor = object_owner.
-- 2) Pre-flight verifies that every pre-existing membership involving managed roles
--    has grantor = session_user / current_user.
-- 3) Staging roles and test runner must not hold grant options or admin options,
--    must not have acted as grantors to other roles, and must not have inverted hierarchies.
-- 4) If any foreign grantor or un-restorable configuration is detected,
--    deployment MUST abort safely before any database mutation.
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Check 4a: Staging roles must not hold grant options or have acted as grantors
    IF EXISTS (
        SELECT 1 FROM information_schema.table_privileges
        WHERE table_schema = 'public'
          AND table_name IN ('health_modules', 'users', 'user_profiles', 'assessments', 'assessment_reports', 'refresh_tokens', 'audit_logs')
          AND (
              grantee IN ('anon', 'authenticated', 'service_role', 'healthsync_test_runner') AND is_grantable = 'YES'
              OR grantor IN ('anon', 'authenticated', 'service_role', 'healthsync_test_runner')
          )
    ) OR EXISTS (
        SELECT 1 FROM information_schema.column_privileges
        WHERE table_schema = 'public'
          AND table_name IN ('health_modules', 'users', 'user_profiles', 'assessments', 'assessment_reports', 'refresh_tokens', 'audit_logs')
          AND (
              grantee IN ('anon', 'authenticated', 'service_role', 'healthsync_test_runner') AND is_grantable = 'YES'
              OR grantor IN ('anon', 'authenticated', 'service_role', 'healthsync_test_runner')
          )
    ) THEN
        RAISE EXCEPTION 'Safety check failed: Staging role holds grant options or acted as a grantor. Exact dependency restoration cannot be guaranteed. Aborting deployment before mutation.';
    END IF;

    -- Check 4b: Verify all pre-existing table grants have grantor = table_owner
    FOR r IN 
        SELECT tp.table_name, tp.grantee, tp.grantor, tp.privilege_type, c.relowner::regrole::text AS table_owner
        FROM information_schema.table_privileges tp
        JOIN pg_class c ON c.relname = tp.table_name
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = tp.table_schema
        WHERE tp.table_schema = 'public'
          AND tp.table_name IN ('health_modules', 'users', 'user_profiles', 'assessments', 'assessment_reports', 'refresh_tokens', 'audit_logs')
          AND tp.grantor <> c.relowner::regrole::text
    LOOP
        RAISE EXCEPTION 'Safety check failed: Target table % has pre-existing grant to role % with foreign grantor % (table owner is %). PostgreSQL cannot guarantee exact grantor restoration upon rollback. Aborting deployment before mutation.',
            r.table_name, r.grantee, r.grantor, r.table_owner;
    END LOOP;

    -- Check 4c: Verify all pre-existing column grants have grantor = table_owner
    FOR r IN 
        SELECT cp.table_name, cp.column_name, cp.grantee, cp.grantor, cp.privilege_type, c.relowner::regrole::text AS table_owner
        FROM information_schema.column_privileges cp
        JOIN pg_class c ON c.relname = cp.table_name
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = cp.table_schema
        WHERE cp.table_schema = 'public'
          AND cp.table_name IN ('health_modules', 'users', 'user_profiles', 'assessments', 'assessment_reports', 'refresh_tokens', 'audit_logs')
          AND cp.grantor <> c.relowner::regrole::text
    LOOP
        RAISE EXCEPTION 'Safety check failed: Target column %.% has pre-existing grant to role % with foreign grantor % (table owner is %). PostgreSQL cannot guarantee exact grantor restoration upon rollback. Aborting deployment before mutation.',
            r.table_name, r.column_name, r.grantee, r.grantor, r.table_owner;
    END LOOP;

    -- Check 4d: Verify all pre-existing schema USAGE grants for staging roles have grantor = schema_owner
    FOR r IN
        SELECT up.object_name AS schema_name, up.grantee, up.grantor, n.nspowner::regrole::text AS schema_owner
        FROM information_schema.usage_privileges up
        JOIN pg_namespace n ON n.nspname = up.object_name
        WHERE up.object_type = 'SCHEMA'
          AND up.object_name = 'public'
          AND up.grantee IN ('anon', 'authenticated', 'service_role', 'healthsync_test_runner', 'PUBLIC')
          AND up.grantor <> n.nspowner::regrole::text
    LOOP
        RAISE EXCEPTION 'Safety check failed: Schema % has pre-existing grant to role % with foreign grantor % (schema owner is %). PostgreSQL cannot guarantee exact grantor restoration upon rollback. Aborting deployment before mutation.',
            r.schema_name, r.grantee, r.grantor, r.schema_owner;
    END LOOP;

    -- Check 4e: Verify pre-existing role membership invariants involving managed roles
    -- 1) Foreign grantor check: grantor must match current execution identity (session_user / current_user)
    FOR r IN
        SELECT r_group.rolname AS role_name, r_member.rolname AS member_name, r_grantor.rolname AS grantor_name,
               session_user::text AS current_session_user
        FROM pg_auth_members m
        JOIN pg_roles r_group ON r_group.oid = m.roleid
        JOIN pg_roles r_member ON r_member.oid = m.member
        JOIN pg_roles r_grantor ON r_grantor.oid = m.grantor
        WHERE (r_group.rolname IN ('anon', 'authenticated', 'service_role', 'healthsync_test_runner')
               OR r_member.rolname IN ('anon', 'authenticated', 'service_role', 'healthsync_test_runner'))
          AND r_grantor.rolname <> session_user::text
          AND r_grantor.rolname <> current_user::text
    LOOP
        RAISE EXCEPTION 'Safety check failed: Pre-existing membership % -> % has foreign grantor % (session user is %). PostgreSQL cannot guarantee exact grantor restoration upon rollback. Aborting before mutation.',
            r.role_name, r.member_name, r.grantor_name, r.current_session_user;
    END LOOP;

    -- 2) Admin option check: healthsync_test_runner or managed roles must not hold ADMIN OPTION
    FOR r IN
        SELECT r_group.rolname AS role_name, r_member.rolname AS member_name
        FROM pg_auth_members m
        JOIN pg_roles r_group ON r_group.oid = m.roleid
        JOIN pg_roles r_member ON r_member.oid = m.member
        WHERE (r_member.rolname = 'healthsync_test_runner' 
               OR r_member.rolname IN ('anon', 'authenticated', 'service_role'))
          AND m.admin_option IS TRUE
    LOOP
        RAISE EXCEPTION 'Safety check failed: Role % holds ADMIN OPTION on %. Exact membership restoration without privilege escalation cannot be guaranteed. Aborting before mutation.',
            r.member_name, r.role_name;
    END LOOP;

    -- 3) Grantor role check: healthsync_test_runner or managed roles must not have acted as grantors to others
    FOR r IN
        SELECT r_group.rolname AS role_name, r_member.rolname AS member_name, r_grantor.rolname AS grantor_name
        FROM pg_auth_members m
        JOIN pg_roles r_group ON r_group.oid = m.roleid
        JOIN pg_roles r_member ON r_member.oid = m.member
        JOIN pg_roles r_grantor ON r_grantor.oid = m.grantor
        WHERE r_grantor.rolname IN ('anon', 'authenticated', 'service_role', 'healthsync_test_runner')
    LOOP
        RAISE EXCEPTION 'Safety check failed: Role % has acted as grantor for membership % -> %. Dependent role memberships cannot be safely restored. Aborting before mutation.',
            r.grantor_name, r.role_name, r.member_name;
    END LOOP;

    -- 4) Inverted hierarchy check: managed roles must not be members of healthsync_test_runner
    FOR r IN
        SELECT r_group.rolname AS role_name, r_member.rolname AS member_name
        FROM pg_auth_members m
        JOIN pg_roles r_group ON r_group.oid = m.roleid
        JOIN pg_roles r_member ON r_member.oid = m.member
        WHERE r_group.rolname = 'healthsync_test_runner'
          AND r_member.rolname IN ('anon', 'authenticated', 'service_role')
    LOOP
        RAISE EXCEPTION 'Safety check failed: Inverted role hierarchy detected where % is a member of healthsync_test_runner. Aborting before mutation.',
            r.member_name;
    END LOOP;

    -- 5) Cross-role hierarchy privilege escalation:
    -- anon must not be member of authenticated or service_role; authenticated must not be member of service_role
    FOR r IN
        SELECT r_group.rolname AS group_role, r_member.rolname AS member_role
        FROM pg_auth_members m
        JOIN pg_roles r_group ON r_group.oid = m.roleid
        JOIN pg_roles r_member ON r_member.oid = m.member
        WHERE (r_member.rolname = 'anon' AND r_group.rolname IN ('authenticated', 'service_role'))
           OR (r_member.rolname = 'authenticated' AND r_group.rolname = 'service_role')
    LOOP
        RAISE EXCEPTION 'Safety check failed: Managed role hierarchy privilege escalation detected: % is a member of %. Incompatible role relationship. Aborting before mutation.',
            r.member_role, r.group_role;
    END LOOP;

    -- 6) Administrative / system role escalation check:
    -- Managed roles must not be members of superuser, bypassrls, createrole, or PostgreSQL predefined roles (literal 'pg_' prefix)
    FOR r IN
        SELECT r_group.rolname AS group_role, r_member.rolname AS member_role
        FROM pg_auth_members m
        JOIN pg_roles r_group ON r_group.oid = m.roleid
        JOIN pg_roles r_member ON r_member.oid = m.member
        WHERE r_member.rolname IN ('anon', 'authenticated', 'service_role')
          AND (
              r_group.rolsuper IS TRUE 
              OR r_group.rolbypassrls IS TRUE 
              OR r_group.rolcreaterole IS TRUE
              OR starts_with(r_group.rolname, 'pg_')
          )
    LOOP
        RAISE EXCEPTION 'Safety check failed: Pre-existing managed role % is a member of administrative role %. This bypasses application security and RLS boundaries. Aborting before mutation.',
            r.member_role, r.group_role;
    END LOOP;

    -- 7) External ADMIN OPTION check:
    -- Reject unauthorized non-superuser ADMIN OPTION grants ON anon, authenticated, or service_role.
    -- Legitimate pre-existing superuser-controlled administration is preserved.
    FOR r IN
        SELECT r_group.rolname AS role_name, r_member.rolname AS member_name
        FROM pg_auth_members m
        JOIN pg_roles r_group ON r_group.oid = m.roleid
        JOIN pg_roles r_member ON r_member.oid = m.member
        WHERE r_group.rolname IN ('anon', 'authenticated', 'service_role')
          AND m.admin_option IS TRUE
          AND r_member.rolsuper IS FALSE
    LOOP
        RAISE EXCEPTION 'Safety check failed: Unauthorized non-superuser member % holds ADMIN OPTION on managed role %. Delegated role administration detected. Aborting before mutation.',
            r.member_name, r.role_name;
    END LOOP;

    -- 8) Object ownership check:
    -- Managed roles must not own database relations (tables, views, sequences) in public schema
    FOR r IN
        SELECT c.relname, n.nspname, r_owner.rolname AS owner_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_roles r_owner ON r_owner.oid = c.relowner
        WHERE n.nspname = 'public'
          AND r_owner.rolname IN ('anon', 'authenticated', 'service_role')
    LOOP
        RAISE EXCEPTION 'Safety check failed: Pre-existing managed role % owns object %.% in public schema. Managed roles must not own database objects. Aborting before mutation.',
            r.owner_name, r.nspname, r.relname;
    END LOOP;

    -- 9) Routine ownership check:
    -- Managed roles must not own functions or procedures in public schema
    FOR r IN
        SELECT p.proname, n.nspname, r_owner.rolname AS owner_name,
               CASE p.prokind
                   WHEN 'p' THEN 'procedure'
                   WHEN 'a' THEN 'aggregate'
                   WHEN 'w' THEN 'window function'
                   ELSE 'function'
               END AS routine_type
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        JOIN pg_roles r_owner ON r_owner.oid = p.proowner
        WHERE n.nspname = 'public'
          AND r_owner.rolname IN ('anon', 'authenticated', 'service_role')
    LOOP
        RAISE EXCEPTION 'Safety check failed: Pre-existing managed role % owns % %.% in public schema. Managed roles must not own database routines. Aborting before mutation.',
            r.owner_name, r.routine_type, r.nspname, r.proname;
    END LOOP;

    -- 10) Pre-existing membership options check for healthsync_test_runner:
    -- Pre-existing memberships for healthsync_test_runner must have inherit_option=false and set_option=true
    FOR r IN
        SELECT r_group.rolname AS role_name, r_member.rolname AS member_name,
               COALESCE((to_jsonb(m)->>'inherit_option')::boolean, r_member.rolinherit) AS inherit_opt,
               COALESCE((to_jsonb(m)->>'set_option')::boolean, true) AS set_opt
        FROM pg_auth_members m
        JOIN pg_roles r_group ON r_group.oid = m.roleid
        JOIN pg_roles r_member ON r_member.oid = m.member
        WHERE r_member.rolname = 'healthsync_test_runner'
          AND r_group.rolname IN ('anon', 'authenticated', 'service_role')
    LOOP
        IF r.inherit_opt IS TRUE THEN
            RAISE EXCEPTION 'Safety check failed: Pre-existing membership % -> % has inherit_option=true. Automatic privilege inheritance breaks isolated SET ROLE security testing. Aborting before mutation.',
                r.role_name, r.member_name;
        END IF;
        IF r.set_opt IS FALSE THEN
            RAISE EXCEPTION 'Safety check failed: Pre-existing membership % -> % has set_option=false. The test runner is prohibited from assuming the role via SET ROLE. Aborting before mutation.',
                r.role_name, r.member_name;
        END IF;
    END LOOP;

    -- 11) Schema CREATE privilege check:
    -- anon and authenticated must not have CREATE privilege on public schema
    FOR r IN
        SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
    LOOP
        IF has_schema_privilege(r.rolname, 'public', 'CREATE') THEN
            RAISE EXCEPTION 'Safety check failed: Pre-existing managed role % has CREATE privilege on public schema. Schema creation privileges violate least-privilege boundaries. Aborting before mutation.', r.rolname;
        END IF;
    END LOOP;

    -- 12) Database CREATE privilege check:
    -- anon and authenticated must not have CREATE privilege on current database
    FOR r IN
        SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
    LOOP
        IF has_database_privilege(r.rolname, current_database(), 'CREATE') THEN
            RAISE EXCEPTION 'Safety check failed: Pre-existing managed role % has CREATE privilege on database %. Aborting before mutation.', r.rolname, current_database();
        END IF;
    END LOOP;
END $$;

-- 5. Create Pre-Deployment State Snapshot Table
CREATE TABLE public._healthsync_staging_manifest (
    id serial PRIMARY KEY,
    phase text NOT NULL,
    snapshot_key text NOT NULL UNIQUE,
    data jsonb NOT NULL,
    captured_at timestamptz NOT NULL DEFAULT now()
);

-- Record that this manifest table was created by this deployment (used to guard rollback drops)
INSERT INTO public._healthsync_staging_manifest (phase, snapshot_key, data)
VALUES (
    'manifest',
    'manifest_created_by_deployment',
    jsonb_build_object(
        'created_at', now(),
        'created_by_script', 'staging_roles_and_permissions.sql',
        'table_name', 'public._healthsync_staging_manifest'
    )
);

-- 6. Capture Pre-Deployment Role Existence & Memberships
INSERT INTO public._healthsync_staging_manifest (phase, snapshot_key, data)
VALUES (
    'roles',
    'roles_pre_existence',
    jsonb_build_object(
        'anon_exists', EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'anon'),
        'authenticated_exists', EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'),
        'service_role_exists', EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'service_role'),
        'test_runner_exists', EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'healthsync_test_runner'),
        'anon_attributes', (
            SELECT jsonb_build_object('rolcanlogin', r.rolcanlogin, 'rolinherit', r.rolinherit, 'rolsuper', r.rolsuper, 'rolcreatedb', r.rolcreatedb, 'rolcreaterole', r.rolcreaterole, 'rolreplication', r.rolreplication, 'rolbypassrls', r.rolbypassrls, 'rolconnlimit', r.rolconnlimit, 'rolvaliduntil', r.rolvaliduntil::text)
            FROM pg_roles r WHERE r.rolname = 'anon'
        ),
        'authenticated_attributes', (
            SELECT jsonb_build_object('rolcanlogin', r.rolcanlogin, 'rolinherit', r.rolinherit, 'rolsuper', r.rolsuper, 'rolcreatedb', r.rolcreatedb, 'rolcreaterole', r.rolcreaterole, 'rolreplication', r.rolreplication, 'rolbypassrls', r.rolbypassrls, 'rolconnlimit', r.rolconnlimit, 'rolvaliduntil', r.rolvaliduntil::text)
            FROM pg_roles r WHERE r.rolname = 'authenticated'
        ),
        'service_role_attributes', (
            SELECT jsonb_build_object('rolcanlogin', r.rolcanlogin, 'rolinherit', r.rolinherit, 'rolsuper', r.rolsuper, 'rolcreatedb', r.rolcreatedb, 'rolcreaterole', r.rolcreaterole, 'rolreplication', r.rolreplication, 'rolbypassrls', r.rolbypassrls, 'rolconnlimit', r.rolconnlimit, 'rolvaliduntil', r.rolvaliduntil::text)
            FROM pg_roles r WHERE r.rolname = 'service_role'
        ),
        'test_runner_had_anon', EXISTS(
            SELECT 1 FROM pg_auth_members m
            JOIN pg_roles r_member ON r_member.oid = m.member
            JOIN pg_roles r_group ON r_group.oid = m.roleid
            WHERE r_member.rolname = 'healthsync_test_runner' AND r_group.rolname = 'anon'
        ),
        'test_runner_had_authenticated', EXISTS(
            SELECT 1 FROM pg_auth_members m
            JOIN pg_roles r_member ON r_member.oid = m.member
            JOIN pg_roles r_group ON r_group.oid = m.roleid
            WHERE r_member.rolname = 'healthsync_test_runner' AND r_group.rolname = 'authenticated'
        ),
        'test_runner_had_service_role', EXISTS(
            SELECT 1 FROM pg_auth_members m
            JOIN pg_roles r_member ON r_member.oid = m.member
            JOIN pg_roles r_group ON r_group.oid = m.roleid
            WHERE r_member.rolname = 'healthsync_test_runner' AND r_group.rolname = 'service_role'
        )
    )
);

-- Capture complete pre-existing memberships involving healthsync_test_runner and managed roles
INSERT INTO public._healthsync_staging_manifest (phase, snapshot_key, data)
SELECT
    'roles',
    'role_memberships_pre',
    COALESCE(jsonb_agg(jsonb_build_object(
        'role_name', r_group.rolname,
        'member_name', r_member.rolname,
        'grantor_name', r_grantor.rolname,
        'admin_option', m.admin_option,
        'inherit_option', COALESCE((to_jsonb(m)->>'inherit_option')::boolean, true),
        'set_option', COALESCE((to_jsonb(m)->>'set_option')::boolean, true)
    )), '[]'::jsonb)
FROM pg_auth_members m
JOIN pg_roles r_group ON r_group.oid = m.roleid
JOIN pg_roles r_member ON r_member.oid = m.member
JOIN pg_roles r_grantor ON r_grantor.oid = m.grantor
WHERE r_group.rolname IN ('anon', 'authenticated', 'service_role', 'healthsync_test_runner')
   OR r_member.rolname IN ('anon', 'authenticated', 'service_role', 'healthsync_test_runner');

-- 7. Capture Pre-Deployment Attributes of healthsync_test_runner (for exact restoration)
INSERT INTO public._healthsync_staging_manifest (phase, snapshot_key, data)
SELECT 
    'roles',
    'test_runner_pre_attributes',
    jsonb_build_object(
        'existed', (r.rolname IS NOT NULL),
        'rolcanlogin', r.rolcanlogin,
        'rolinherit', r.rolinherit,
        'rolsuper', r.rolsuper,
        'rolcreatedb', r.rolcreatedb,
        'rolcreaterole', r.rolcreaterole,
        'rolreplication', r.rolreplication,
        'rolbypassrls', r.rolbypassrls,
        'rolconnlimit', r.rolconnlimit,
        'rolvaliduntil', r.rolvaliduntil::text
    )
FROM (SELECT 1) dummy
LEFT JOIN pg_roles r ON r.rolname = 'healthsync_test_runner';

-- 8. Capture Pre-Deployment Schema USAGE Permissions
INSERT INTO public._healthsync_staging_manifest (phase, snapshot_key, data)
VALUES (
    'permissions',
    'schema_acls_pre',
    jsonb_build_object(
        'anon_had_usage', (
            SELECT CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'anon') 
                        THEN has_schema_privilege('anon', 'public', 'USAGE') 
                        ELSE false END
        ),
        'authenticated_had_usage', (
            SELECT CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') 
                        THEN has_schema_privilege('authenticated', 'public', 'USAGE') 
                        ELSE false END
        ),
        'service_role_had_usage', (
            SELECT CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'service_role') 
                        THEN has_schema_privilege('service_role', 'public', 'USAGE') 
                        ELSE false END
        ),
        'test_runner_had_usage', (
            SELECT CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'healthsync_test_runner') 
                        THEN has_schema_privilege('healthsync_test_runner', 'public', 'USAGE') 
                        ELSE false END
        ),
        'structured_privileges', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'grantor', grantor,
                'grantee', grantee,
                'privilege_type', privilege_type,
                'is_grantable', is_grantable
            )), '[]'::jsonb)
            FROM information_schema.usage_privileges
            WHERE object_type = 'SCHEMA' AND object_name = 'public'
              AND grantee IN ('anon', 'authenticated', 'service_role', 'healthsync_test_runner', 'PUBLIC')
        )
    )
);

-- 9. Capture Pre-Deployment Table ACLs (Structured from information_schema)
INSERT INTO public._healthsync_staging_manifest (phase, snapshot_key, data)
SELECT 
    'permissions',
    'table_acls_pre',
    COALESCE(jsonb_agg(jsonb_build_object(
        'grantor', grantor,
        'grantee', grantee,
        'table_name', table_name,
        'privilege_type', privilege_type,
        'is_grantable', is_grantable
    )), '[]'::jsonb)
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
  AND table_name IN ('health_modules', 'users', 'user_profiles', 'assessments', 'assessment_reports', 'refresh_tokens', 'audit_logs');

-- 10. Capture Pre-Deployment Column ACLs (Structured from information_schema)
INSERT INTO public._healthsync_staging_manifest (phase, snapshot_key, data)
SELECT 
    'permissions',
    'column_acls_pre',
    COALESCE(jsonb_agg(jsonb_build_object(
        'grantor', grantor,
        'grantee', grantee,
        'table_name', table_name,
        'column_name', column_name,
        'privilege_type', privilege_type,
        'is_grantable', is_grantable
    )), '[]'::jsonb)
FROM information_schema.column_privileges
WHERE table_schema = 'public' 
  AND table_name IN ('health_modules', 'users', 'user_profiles', 'assessments', 'assessment_reports', 'refresh_tokens', 'audit_logs');

-- 11. Capture Pre-Deployment Table RLS & Force Flags
INSERT INTO public._healthsync_staging_manifest (phase, snapshot_key, data)
SELECT 
    'rls',
    'rls_flags_pre',
    jsonb_agg(jsonb_build_object(
        'table_name', c.relname,
        'relrowsecurity', c.relrowsecurity,
        'relforcerowsecurity', c.relforcerowsecurity
    ))
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relname IN ('health_modules', 'users', 'user_profiles', 'assessments', 'assessment_reports', 'refresh_tokens', 'audit_logs');

-- 12. Capture Pre-Deployment Policies (Including permissive column for exact fidelity)
INSERT INTO public._healthsync_staging_manifest (phase, snapshot_key, data)
SELECT 
    'rls',
    'policies_pre',
    COALESCE(jsonb_agg(jsonb_build_object(
        'schemaname', schemaname,
        'tablename', tablename,
        'policyname', policyname,
        'permissive', permissive,
        'roles', roles,
        'cmd', cmd,
        'qual', qual,
        'with_check', with_check
    )), '[]'::jsonb)
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('health_modules', 'users', 'user_profiles', 'assessments', 'assessment_reports', 'refresh_tokens', 'audit_logs');

-- 13. Safety Check: Verify Baseline Snapshot Completeness Before Any Mutation
DO $$
DECLARE
    v_count integer;
BEGIN
    SELECT count(*) INTO v_count
    FROM public._healthsync_staging_manifest
    WHERE snapshot_key IN (
        'manifest_created_by_deployment',
        'roles_pre_existence', 
        'role_memberships_pre',
        'test_runner_pre_attributes',
        'schema_acls_pre', 
        'table_acls_pre', 
        'column_acls_pre', 
        'rls_flags_pre', 
        'policies_pre'
    );

    IF v_count < 9 THEN
        RAISE EXCEPTION 'Safety check failed: Incomplete pre-deployment snapshot (expected 9 keys, found %). Aborting before making any changes.', v_count;
    END IF;
END $$;

-- 14. Provision NOLOGIN Role Groups (Supabase/PostgREST compatible)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
    END IF;
END $$;

-- 15. Provision Dedicated Non-Owner Test Runner Role (Created with PASSWORD NULL; set via stdin / \password)
DO $$
DECLARE
    v_super boolean;
    v_bypass boolean;
    v_inherit boolean;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'healthsync_test_runner') THEN
        CREATE ROLE healthsync_test_runner WITH 
            LOGIN 
            NOSUPERUSER 
            NOCREATEDB 
            NOCREATEROLE 
            NOBYPASSRLS 
            NOINHERIT;
    ELSE
        ALTER ROLE healthsync_test_runner WITH 
            NOSUPERUSER 
            NOCREATEDB 
            NOCREATEROLE 
            NOBYPASSRLS 
            NOINHERIT;
    END IF;

    -- Verify attributes immediately
    SELECT rolsuper, rolbypassrls, rolinherit INTO v_super, v_bypass, v_inherit
    FROM pg_roles WHERE rolname = 'healthsync_test_runner';

    IF v_super IS TRUE OR v_bypass IS TRUE OR v_inherit IS TRUE THEN
        RAISE EXCEPTION 'Security invariant failed: healthsync_test_runner has unexpected elevated privileges.';
    END IF;
END $$;

-- Grant role memberships for controlled SET ROLE testing only (explicit NOINHERIT prevents automatic inheritance)
GRANT anon TO healthsync_test_runner WITH INHERIT FALSE, SET TRUE;
GRANT authenticated TO healthsync_test_runner WITH INHERIT FALSE, SET TRUE;
GRANT service_role TO healthsync_test_runner WITH INHERIT FALSE, SET TRUE;

-- 16. Clean Slate Table Revocations
REVOKE ALL ON TABLE public.users FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.assessments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.assessment_reports FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.refresh_tokens FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.audit_logs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.health_modules FROM PUBLIC;

-- 17. Schema Usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, healthsync_test_runner;

-- 18. Effective Least-Privilege Grants
GRANT SELECT ON TABLE public.health_modules TO anon, authenticated, service_role;

-- Users table: column-level INSERT for anon; column-level UPDATE for authenticated; service_role administrative
GRANT INSERT (id, email, password_hash, full_name, date_of_birth, gender, role, is_active, is_verified, created_at, updated_at) 
    ON TABLE public.users TO anon;

GRANT SELECT, INSERT ON TABLE public.users TO authenticated;
GRANT UPDATE (full_name, gender, date_of_birth, password_hash, updated_at) ON TABLE public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO service_role;

-- User profiles table
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_profiles TO service_role;

-- Assessments table
GRANT SELECT, INSERT, UPDATE ON TABLE public.assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assessments TO service_role;

-- Assessment reports: strictly immutable clinical documents (SELECT, INSERT only)
GRANT SELECT, INSERT ON TABLE public.assessment_reports TO authenticated;
GRANT SELECT, INSERT ON TABLE public.assessment_reports TO service_role;

-- Refresh tokens
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.refresh_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.refresh_tokens TO service_role;

-- Audit logs: append-only for app and unauthenticated auth attempts; SELECT restricted to admin
GRANT INSERT ON TABLE public.audit_logs TO anon;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO authenticated;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO service_role;

-- Explicitly revoke destructive permissions on immutable tables
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_logs FROM PUBLIC, anon, authenticated, service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.assessment_reports FROM PUBLIC, anon, authenticated, service_role;

-- 19. Track Applied Staging Grants in Manifest (used for targeted, non-indiscriminate rollback)
INSERT INTO public._healthsync_staging_manifest (phase, snapshot_key, data)
VALUES (
    'deployment_tracking',
    'script_1_applied',
    jsonb_build_object(
        'applied_at', now(),
        'roles_managed', jsonb_build_array('anon', 'authenticated', 'service_role', 'healthsync_test_runner'),
        'tables_managed', jsonb_build_array('health_modules', 'users', 'user_profiles', 'assessments', 'assessment_reports', 'refresh_tokens', 'audit_logs'),
        'staging_column_grants', jsonb_build_array(
            jsonb_build_object('table', 'users', 'role', 'anon', 'privilege', 'INSERT', 'columns', jsonb_build_array('id', 'email', 'password_hash', 'full_name', 'date_of_birth', 'gender', 'role', 'is_active', 'is_verified', 'created_at', 'updated_at')),
            jsonb_build_object('table', 'users', 'role', 'authenticated', 'privilege', 'UPDATE', 'columns', jsonb_build_array('full_name', 'gender', 'date_of_birth', 'password_hash', 'updated_at'))
        ),
        'staging_table_grants', jsonb_build_array(
            jsonb_build_object('table', 'health_modules', 'role', 'anon', 'privileges', jsonb_build_array('SELECT')),
            jsonb_build_object('table', 'health_modules', 'role', 'authenticated', 'privileges', jsonb_build_array('SELECT')),
            jsonb_build_object('table', 'health_modules', 'role', 'service_role', 'privileges', jsonb_build_array('SELECT')),
            jsonb_build_object('table', 'users', 'role', 'authenticated', 'privileges', jsonb_build_array('SELECT', 'INSERT')),
            jsonb_build_object('table', 'users', 'role', 'service_role', 'privileges', jsonb_build_array('SELECT', 'INSERT', 'UPDATE', 'DELETE')),
            jsonb_build_object('table', 'user_profiles', 'role', 'authenticated', 'privileges', jsonb_build_array('SELECT', 'INSERT', 'UPDATE')),
            jsonb_build_object('table', 'user_profiles', 'role', 'service_role', 'privileges', jsonb_build_array('SELECT', 'INSERT', 'UPDATE', 'DELETE')),
            jsonb_build_object('table', 'assessments', 'role', 'authenticated', 'privileges', jsonb_build_array('SELECT', 'INSERT', 'UPDATE')),
            jsonb_build_object('table', 'assessments', 'role', 'service_role', 'privileges', jsonb_build_array('SELECT', 'INSERT', 'UPDATE', 'DELETE')),
            jsonb_build_object('table', 'assessment_reports', 'role', 'authenticated', 'privileges', jsonb_build_array('SELECT', 'INSERT')),
            jsonb_build_object('table', 'assessment_reports', 'role', 'service_role', 'privileges', jsonb_build_array('SELECT', 'INSERT')),
            jsonb_build_object('table', 'refresh_tokens', 'role', 'authenticated', 'privileges', jsonb_build_array('SELECT', 'INSERT', 'UPDATE', 'DELETE')),
            jsonb_build_object('table', 'refresh_tokens', 'role', 'service_role', 'privileges', jsonb_build_array('SELECT', 'INSERT', 'UPDATE', 'DELETE')),
            jsonb_build_object('table', 'audit_logs', 'role', 'anon', 'privileges', jsonb_build_array('INSERT')),
            jsonb_build_object('table', 'audit_logs', 'role', 'authenticated', 'privileges', jsonb_build_array('SELECT', 'INSERT')),
            jsonb_build_object('table', 'audit_logs', 'role', 'service_role', 'privileges', jsonb_build_array('SELECT', 'INSERT'))
        )
    )
);
