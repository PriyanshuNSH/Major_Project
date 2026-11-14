-- ============================================================================
-- HealthSync AI — Partial-Failure Roles & Permissions Recovery Script
-- Engine: Neon PostgreSQL 18.6
-- Usage: psql --variable=ON_ERROR_STOP=1 --single-transaction -f staging_roles_recovery.sql
-- Purpose: Reverses all changes made by staging_roles_and_permissions.sql
--          when staging_rls.sql fails or deployment is aborted after Script 1.
-- ============================================================================

\set ON_ERROR_STOP on

-- 1. Pre-Flight Safety Checks (Must execute before ANY database mutations)
-- Verifies manifest table, deployment provenance, baseline snapshots, and exact grantor invariants.
DO $$
DECLARE
    v_missing text;
    v_tbl_acls jsonb;
    v_col_acls jsonb;
    v_memberships_pre jsonb;
    r RECORD;
BEGIN
    -- Check 1a: Manifest table must exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = '_healthsync_staging_manifest'
    ) THEN
        RAISE EXCEPTION 'Recovery failed: public._healthsync_staging_manifest does not exist. Cannot safely restore pre-deployment baseline without recorded manifest.';
    END IF;

    -- Check 1b: Manifest must have been created by this deployment
    IF NOT EXISTS (
        SELECT 1 FROM public._healthsync_staging_manifest WHERE snapshot_key = 'manifest_created_by_deployment'
    ) THEN
        RAISE EXCEPTION 'Recovery failed: manifest_created_by_deployment key not found in manifest. Refusing to operate on an unrecognized manifest table.';
    END IF;

    -- Check 1c: Check required snapshot keys for Script 1 recovery
    SELECT string_agg(k, ', ') INTO v_missing
    FROM unnest(ARRAY[
        'roles_pre_existence',
        'role_memberships_pre',
        'test_runner_pre_attributes',
        'schema_acls_pre',
        'table_acls_pre',
        'column_acls_pre'
    ]) AS k
    WHERE NOT EXISTS (
        SELECT 1 FROM public._healthsync_staging_manifest WHERE snapshot_key = k
    );

    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'Recovery failed: Required baseline snapshot keys missing from manifest: %. Safe recovery cannot be guaranteed. Aborting before mutation.', v_missing;
    END IF;

    -- Check 1d: Verify table_acls_pre grantor restoration invariant
    -- Re-executing GRANT under current user requires that the original grantor matches the table owner
    -- and that the executing user has authorization to restore grants under original grantor identity.
    SELECT data INTO v_tbl_acls FROM public._healthsync_staging_manifest WHERE snapshot_key = 'table_acls_pre';
    IF v_tbl_acls IS NOT NULL THEN
        FOR r IN 
            SELECT snap.table_name, snap.grantee, snap.grantor, c.relowner::regrole::text AS table_owner, current_user::text AS exec_user
            FROM jsonb_to_recordset(v_tbl_acls) AS snap(grantor text, grantee text, table_name text, privilege_type text, is_grantable text)
            JOIN pg_class c ON c.relname = snap.table_name
            JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
            WHERE snap.grantee <> c.relowner::regrole::text
              AND (
                  snap.grantor <> c.relowner::regrole::text
                  OR (
                      snap.grantor <> current_user::text
                      AND snap.grantor <> session_user::text
                      AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper IS TRUE)
                      AND NOT EXISTS (
                          SELECT 1 FROM pg_auth_members m
                          JOIN pg_roles rg ON rg.oid = m.roleid
                          JOIN pg_roles rm ON rm.oid = m.member
                          WHERE rg.rolname = snap.grantor AND rm.rolname = current_user
                      )
                  )
              )
        LOOP
            RAISE EXCEPTION 'Recovery pre-flight failed: Snapshot table grant on % to % has grantor % (owner is %, executing user is %). Executing user lacks authorization to restore grant under original grantor identity. PostgreSQL cannot guarantee exact grantor restoration upon recovery. Aborting before mutation.',
                r.table_name, r.grantee, r.grantor, r.table_owner, r.exec_user;
        END LOOP;
    END IF;

    -- Check 1e: Verify column_acls_pre grantor restoration invariant
    SELECT data INTO v_col_acls FROM public._healthsync_staging_manifest WHERE snapshot_key = 'column_acls_pre';
    IF v_col_acls IS NOT NULL THEN
        FOR r IN 
            SELECT snap.table_name, snap.column_name, snap.grantee, snap.grantor, c.relowner::regrole::text AS table_owner, current_user::text AS exec_user
            FROM jsonb_to_recordset(v_col_acls) AS snap(grantor text, grantee text, table_name text, column_name text, privilege_type text, is_grantable text)
            JOIN pg_class c ON c.relname = snap.table_name
            JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
            WHERE snap.grantee <> c.relowner::regrole::text
              AND (
                  snap.grantor <> c.relowner::regrole::text
                  OR (
                      snap.grantor <> current_user::text
                      AND snap.grantor <> session_user::text
                      AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper IS TRUE)
                      AND NOT EXISTS (
                          SELECT 1 FROM pg_auth_members m
                          JOIN pg_roles rg ON rg.oid = m.roleid
                          JOIN pg_roles rm ON rm.oid = m.member
                          WHERE rg.rolname = snap.grantor AND rm.rolname = current_user
                      )
                  )
              )
        LOOP
            RAISE EXCEPTION 'Recovery pre-flight failed: Snapshot column grant on %.% to % has grantor % (owner is %, executing user is %). Exact grantor restoration cannot be guaranteed. Aborting before mutation.',
                r.table_name, r.column_name, r.grantee, r.grantor, r.table_owner, r.exec_user;
        END LOOP;
    END IF;

    -- Check 1f: Verify role_memberships_pre grantor restoration invariant & GRANTED BY support
    -- PostgreSQL GRANTED BY requires that the executing user is the grantor, a member of the grantor with ADMIN OPTION, or a superuser.
    SELECT data INTO v_memberships_pre FROM public._healthsync_staging_manifest WHERE snapshot_key = 'role_memberships_pre';
    IF v_memberships_pre IS NOT NULL THEN
        -- Verify authorization to restore original grantors
        IF jsonb_array_length(v_memberships_pre) > 0 THEN
            FOR r IN 
                SELECT snap.role_name, snap.member_name, snap.grantor_name, current_user::text AS executing_user
                FROM jsonb_to_recordset(v_memberships_pre) AS snap(role_name text, member_name text, grantor_name text, admin_option boolean, inherit_option boolean, set_option boolean)
                WHERE snap.grantor_name <> current_user::text
                  AND snap.grantor_name <> session_user::text
                  AND NOT EXISTS (
                      SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper IS TRUE
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM pg_auth_members m
                      JOIN pg_roles r_grantor ON r_grantor.oid = m.roleid
                      JOIN pg_roles r_curr ON r_curr.oid = m.member
                      WHERE r_grantor.rolname = snap.grantor_name
                        AND r_curr.rolname = current_user
                        AND m.admin_option IS TRUE
                  )
            LOOP
                RAISE EXCEPTION 'Recovery pre-flight failed: Cannot safely restore membership % -> % with original grantor % because executing user % lacks superuser or ADMIN OPTION on grantor. PostgreSQL GRANTED BY semantics cannot be satisfied. Aborting before mutation.',
                    r.role_name, r.member_name, r.grantor_name, r.executing_user;
            END LOOP;
        END IF;

        -- Verify authorization to revoke deployment-created memberships with specific grantors
        FOR r IN 
            SELECT r_group.rolname AS role_name, r_member.rolname AS member_name, r_grantor.rolname AS grantor_name, current_user::text AS executing_user
            FROM pg_auth_members m
            JOIN pg_roles r_group ON r_group.oid = m.roleid
            JOIN pg_roles r_member ON r_member.oid = m.member
            JOIN pg_roles r_grantor ON r_grantor.oid = m.grantor
            WHERE (r_group.rolname IN ('anon', 'authenticated', 'service_role', 'healthsync_test_runner')
                   OR r_member.rolname IN ('anon', 'authenticated', 'service_role', 'healthsync_test_runner'))
              AND NOT EXISTS (
                  SELECT 1 FROM jsonb_to_recordset(v_memberships_pre) AS snap(
                      role_name text, member_name text, grantor_name text, admin_option boolean, inherit_option boolean, set_option boolean
                  )
                  WHERE snap.role_name = r_group.rolname
                    AND snap.member_name = r_member.rolname
                    AND snap.grantor_name = r_grantor.rolname
              )
              AND r_grantor.rolname <> current_user::text
              AND r_grantor.rolname <> session_user::text
              AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper IS TRUE)
              AND NOT EXISTS (
                  SELECT 1 FROM pg_auth_members am
                  JOIN pg_roles ag ON ag.oid = am.roleid
                  JOIN pg_roles ac ON ac.oid = am.member
                  WHERE ag.rolname = r_grantor.rolname
                    AND ac.rolname = current_user
                    AND am.admin_option IS TRUE
              )
        LOOP
            RAISE EXCEPTION 'Recovery pre-flight failed: Cannot safely revoke deployment membership % -> % with grantor % because executing user % lacks superuser or ADMIN OPTION on grantor. Aborting before mutation.',
                r.role_name, r.member_name, r.grantor_name, r.executing_user;
        END LOOP;
    END IF;
END $$;

-- 2. Strict Safety Check: Abort Immediately if Script 2 Was Applied or Started
-- Partial-failure recovery is strictly for reversing Script 1 when Script 2 has not run or failed.
-- If Script 2 completed or started mutating objects, full rollback via staging_rollback.sql is strictly required.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public._healthsync_staging_manifest 
        WHERE snapshot_key IN ('script_2_applied', 'script_2_objects', 'function_auth_is_admin_pre', 'indexes_gin_pre')
    ) THEN
        RAISE EXCEPTION 'Safety check failed: Script 2 (staging_rls.sql) has already been applied or started. Partial recovery cannot safely reverse RLS policies, functions, or indexes. You must execute staging_rollback.sql instead. Aborting recovery without changes.';
    END IF;
END $$;

-- 3. Actively Restore Exact Pre-Deployment Column ACLs from column_acls_pre Snapshot
DO $$
DECLARE
    v_col_acls jsonb;
    curr_cp RECORD;
    snap_cp RECORD;
    v_target text;
    v_sql text;
BEGIN
    SELECT data INTO v_col_acls 
    FROM public._healthsync_staging_manifest 
    WHERE snapshot_key = 'column_acls_pre';

    IF v_col_acls IS NOT NULL THEN
        -- 3a. Revoke any column grants currently present that were NOT in the pre-deployment snapshot (No CASCADE)
        FOR curr_cp IN 
            SELECT cp.table_name, cp.column_name, cp.grantee, cp.privilege_type, cp.is_grantable
            FROM information_schema.column_privileges cp
            JOIN pg_class c ON c.relname = cp.table_name
            JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = cp.table_schema
            WHERE cp.table_schema = 'public'
              AND cp.table_name IN ('health_modules', 'users', 'user_profiles', 'assessments', 'assessment_reports', 'refresh_tokens', 'audit_logs')
              AND cp.grantee <> c.relowner::regrole::text
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM jsonb_to_recordset(v_col_acls) AS snap(
                    grantor text, grantee text, table_name text, column_name text, privilege_type text, is_grantable text
                )
                WHERE snap.table_name = curr_cp.table_name
                  AND snap.column_name = curr_cp.column_name
                  AND snap.grantee = curr_cp.grantee
                  AND snap.privilege_type = curr_cp.privilege_type
                  AND snap.is_grantable = curr_cp.is_grantable
            ) THEN
                IF curr_cp.grantee = 'PUBLIC' THEN
                    EXECUTE format('REVOKE %s (%I) ON TABLE public.%I FROM PUBLIC',
                                   curr_cp.privilege_type, curr_cp.column_name, curr_cp.table_name);
                ELSIF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = curr_cp.grantee) THEN
                    EXECUTE format('REVOKE %s (%I) ON TABLE public.%I FROM %I',
                                   curr_cp.privilege_type, curr_cp.column_name, curr_cp.table_name, curr_cp.grantee);
                END IF;
            END IF;
        END LOOP;

        -- 3b. Re-grant any column grants from pre-deployment snapshot that are currently missing
        FOR snap_cp IN 
            SELECT snap.table_name, snap.column_name, snap.grantee, snap.privilege_type, snap.is_grantable
            FROM jsonb_to_recordset(v_col_acls) AS snap(
                grantor text, grantee text, table_name text, column_name text, privilege_type text, is_grantable text
            )
            JOIN pg_class c ON c.relname = snap.table_name
            JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
            WHERE snap.grantee <> c.relowner::regrole::text
        LOOP
            IF snap_cp.grantee = 'PUBLIC' THEN
                v_target := 'PUBLIC';
            ELSIF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = snap_cp.grantee) THEN
                v_target := quote_ident(snap_cp.grantee);
            ELSE
                CONTINUE;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.column_privileges cp
                WHERE cp.table_schema = 'public'
                  AND cp.table_name = snap_cp.table_name
                  AND cp.column_name = snap_cp.column_name
                  AND cp.grantee = snap_cp.grantee
                  AND cp.privilege_type = snap_cp.privilege_type
                  AND cp.is_grantable = snap_cp.is_grantable
            ) THEN
                v_sql := format('GRANT %s (%I) ON TABLE public.%I TO %s',
                                snap_cp.privilege_type, snap_cp.column_name, snap_cp.table_name, v_target);
                IF snap_cp.is_grantable = 'YES' THEN
                    v_sql := v_sql || ' WITH GRANT OPTION';
                END IF;
                EXECUTE v_sql;
            END IF;
        END LOOP;
    END IF;
END $$;

-- 4. Actively Restore Exact Pre-Deployment Table ACLs from table_acls_pre Snapshot
DO $$
DECLARE
    v_tbl_acls jsonb;
    curr_tp RECORD;
    snap_tp RECORD;
    v_target text;
    v_sql text;
BEGIN
    SELECT data INTO v_tbl_acls 
    FROM public._healthsync_staging_manifest 
    WHERE snapshot_key = 'table_acls_pre';

    IF v_tbl_acls IS NOT NULL THEN
        -- 4a. Revoke any table grants currently present that were NOT in the pre-deployment snapshot (No CASCADE)
        FOR curr_tp IN 
            SELECT tp.table_name, tp.grantee, tp.privilege_type, tp.is_grantable
            FROM information_schema.table_privileges tp
            JOIN pg_class c ON c.relname = tp.table_name
            JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = tp.table_schema
            WHERE tp.table_schema = 'public'
              AND tp.table_name IN ('health_modules', 'users', 'user_profiles', 'assessments', 'assessment_reports', 'refresh_tokens', 'audit_logs')
              AND tp.grantee <> c.relowner::regrole::text
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM jsonb_to_recordset(v_tbl_acls) AS snap(
                    grantor text, grantee text, table_name text, privilege_type text, is_grantable text
                )
                WHERE snap.table_name = curr_tp.table_name
                  AND snap.grantee = curr_tp.grantee
                  AND snap.privilege_type = curr_tp.privilege_type
                  AND snap.is_grantable = curr_tp.is_grantable
            ) THEN
                IF curr_tp.grantee = 'PUBLIC' THEN
                    EXECUTE format('REVOKE %s ON TABLE public.%I FROM PUBLIC',
                                   curr_tp.privilege_type, curr_tp.table_name);
                ELSIF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = curr_tp.grantee) THEN
                    EXECUTE format('REVOKE %s ON TABLE public.%I FROM %I',
                                   curr_tp.privilege_type, curr_tp.table_name, curr_tp.grantee);
                END IF;
            END IF;
        END LOOP;

        -- 4b. Re-grant any table grants from pre-deployment snapshot that are currently missing
        FOR snap_tp IN 
            SELECT snap.table_name, snap.grantee, snap.privilege_type, snap.is_grantable
            FROM jsonb_to_recordset(v_tbl_acls) AS snap(
                grantor text, grantee text, table_name text, privilege_type text, is_grantable text
            )
            JOIN pg_class c ON c.relname = snap.table_name
            JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
            WHERE snap.grantee <> c.relowner::regrole::text
        LOOP
            IF snap_tp.grantee = 'PUBLIC' THEN
                v_target := 'PUBLIC';
            ELSIF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = snap_tp.grantee) THEN
                v_target := quote_ident(snap_tp.grantee);
            ELSE
                CONTINUE;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_privileges tp
                WHERE tp.table_schema = 'public'
                  AND tp.table_name = snap_tp.table_name
                  AND tp.grantee = snap_tp.grantee
                  AND tp.privilege_type = snap_tp.privilege_type
                  AND tp.is_grantable = snap_tp.is_grantable
            ) THEN
                v_sql := format('GRANT %s ON TABLE public.%I TO %s',
                                snap_tp.privilege_type, snap_tp.table_name, v_target);
                IF snap_tp.is_grantable = 'YES' THEN
                    v_sql := v_sql || ' WITH GRANT OPTION';
                END IF;
                EXECUTE v_sql;
            END IF;
        END LOOP;
    END IF;
END $$;

-- 5. Actively Restore Exact Pre-Deployment Schema USAGE Permissions from schema_acls_pre Snapshot
DO $$
DECLARE
    v_schema_acls jsonb;
BEGIN
    SELECT data INTO v_schema_acls 
    FROM public._healthsync_staging_manifest 
    WHERE snapshot_key = 'schema_acls_pre';

    IF v_schema_acls IS NOT NULL THEN
        -- Restore anon usage
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            IF COALESCE((v_schema_acls->>'anon_had_usage')::boolean, false) THEN
                IF NOT has_schema_privilege('anon', 'public', 'USAGE') THEN
                    GRANT USAGE ON SCHEMA public TO anon;
                END IF;
            ELSE
                IF has_schema_privilege('anon', 'public', 'USAGE') THEN
                    REVOKE USAGE ON SCHEMA public FROM anon;
                END IF;
            END IF;
        END IF;

        -- Restore authenticated usage
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            IF COALESCE((v_schema_acls->>'authenticated_had_usage')::boolean, false) THEN
                IF NOT has_schema_privilege('authenticated', 'public', 'USAGE') THEN
                    GRANT USAGE ON SCHEMA public TO authenticated;
                END IF;
            ELSE
                IF has_schema_privilege('authenticated', 'public', 'USAGE') THEN
                    REVOKE USAGE ON SCHEMA public FROM authenticated;
                END IF;
            END IF;
        END IF;

        -- Restore service_role usage
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
            IF COALESCE((v_schema_acls->>'service_role_had_usage')::boolean, false) THEN
                IF NOT has_schema_privilege('service_role', 'public', 'USAGE') THEN
                    GRANT USAGE ON SCHEMA public TO service_role;
                END IF;
            ELSE
                IF has_schema_privilege('service_role', 'public', 'USAGE') THEN
                    REVOKE USAGE ON SCHEMA public FROM service_role;
                END IF;
            END IF;
        END IF;

        -- Restore test runner usage
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'healthsync_test_runner') THEN
            IF COALESCE((v_schema_acls->>'test_runner_had_usage')::boolean, false) THEN
                IF NOT has_schema_privilege('healthsync_test_runner', 'public', 'USAGE') THEN
                    GRANT USAGE ON SCHEMA public TO healthsync_test_runner;
                END IF;
            ELSE
                IF has_schema_privilege('healthsync_test_runner', 'public', 'USAGE') THEN
                    REVOKE USAGE ON SCHEMA public FROM healthsync_test_runner;
                END IF;
            END IF;
        END IF;
    END IF;
END $$;

-- 6. Actively Reconcile & Restore Exact Role Memberships (Full Tuple: role_name, member_name, grantor_name)
DO $$
DECLARE
    v_memberships_pre jsonb;
    curr_m RECORD;
    snap_m RECORD;
    v_sql text;
BEGIN
    SELECT data INTO v_memberships_pre 
    FROM public._healthsync_staging_manifest 
    WHERE snapshot_key = 'role_memberships_pre';

    IF v_memberships_pre IS NOT NULL THEN
        -- 6a. Revoke any membership tuple (role_name, member_name, grantor_name)
        -- that was NOT present in the pre-deployment snapshot (No CASCADE)
        -- Uses GRANTED BY to safely isolate and remove only the deployment grant without touching other grantors.
        FOR curr_m IN 
            SELECT r_group.rolname AS role_name, r_member.rolname AS member_name, r_grantor.rolname AS grantor_name
            FROM pg_auth_members m
            JOIN pg_roles r_group ON r_group.oid = m.roleid
            JOIN pg_roles r_member ON r_member.oid = m.member
            JOIN pg_roles r_grantor ON r_grantor.oid = m.grantor
            WHERE (r_group.rolname IN ('anon', 'authenticated', 'service_role', 'healthsync_test_runner')
                   OR r_member.rolname IN ('anon', 'authenticated', 'service_role', 'healthsync_test_runner'))
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM jsonb_to_recordset(v_memberships_pre) AS snap(
                    role_name text, member_name text, grantor_name text, admin_option boolean, inherit_option boolean, set_option boolean
                )
                WHERE snap.role_name = curr_m.role_name
                  AND snap.member_name = curr_m.member_name
                  AND snap.grantor_name = curr_m.grantor_name
            ) THEN
                EXECUTE format('REVOKE %I FROM %I GRANTED BY %I', curr_m.role_name, curr_m.member_name, curr_m.grantor_name);
            END IF;
        END LOOP;

        -- 6b. Re-grant and restore exact options and grantor identity for every pre-existing membership
        -- Preserves original grantor via GRANTED BY; executes strictly without silent fallbacks.
        FOR snap_m IN 
            SELECT snap.role_name, snap.member_name, snap.grantor_name, snap.admin_option, snap.inherit_option, snap.set_option
            FROM jsonb_to_recordset(v_memberships_pre) AS snap(
                role_name text, member_name text, grantor_name text, admin_option boolean, inherit_option boolean, set_option boolean
            )
        LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = snap_m.role_name)
               AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = snap_m.member_name)
               AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = snap_m.grantor_name) THEN
                
                -- Check if exact tuple (role, member, grantor) exists with exact admin, inherit, and set options
                IF NOT EXISTS (
                    SELECT 1 FROM pg_auth_members m
                    JOIN pg_roles r_group ON r_group.oid = m.roleid
                    JOIN pg_roles r_member ON r_member.oid = m.member
                    JOIN pg_roles r_grantor ON r_grantor.oid = m.grantor
                    WHERE r_group.rolname = snap_m.role_name
                      AND r_member.rolname = snap_m.member_name
                      AND r_grantor.rolname = snap_m.grantor_name
                      AND m.admin_option = snap_m.admin_option
                      AND COALESCE((to_jsonb(m)->>'inherit_option')::boolean, true) = snap_m.inherit_option
                      AND COALESCE((to_jsonb(m)->>'set_option')::boolean, true) = snap_m.set_option
                ) THEN
                    v_sql := format('GRANT %I TO %I WITH ADMIN %s, INHERIT %s, SET %s GRANTED BY %I',
                        snap_m.role_name,
                        snap_m.member_name,
                        CASE WHEN snap_m.admin_option THEN 'TRUE' ELSE 'FALSE' END,
                        CASE WHEN snap_m.inherit_option THEN 'TRUE' ELSE 'FALSE' END,
                        CASE WHEN snap_m.set_option THEN 'TRUE' ELSE 'FALSE' END,
                        snap_m.grantor_name
                    );
                    -- Strict execution: no silent fallback; aborts transaction if unsupported or unauthorized
                    EXECUTE v_sql;
                END IF;
            END IF;
        END LOOP;
    END IF;
END $$;

-- 7. Restore Attributes of Pre-Existing Managed Roles & healthsync_test_runner
DO $$
DECLARE
    v_attrs jsonb;
    v_roles_pre jsonb;
    v_sql text;
    r_name text;
BEGIN
    -- 7a. Restore healthsync_test_runner attributes
    SELECT data INTO v_attrs 
    FROM public._healthsync_staging_manifest 
    WHERE snapshot_key = 'test_runner_pre_attributes';

    IF v_attrs IS NOT NULL AND COALESCE((v_attrs->>'existed')::boolean, false) IS TRUE AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'healthsync_test_runner') THEN
        v_sql := format('ALTER ROLE healthsync_test_runner WITH %s %s %s %s %s %s %s CONNECTION LIMIT %s',
            CASE WHEN (v_attrs->>'rolcanlogin')::boolean THEN 'LOGIN' ELSE 'NOLOGIN' END,
            CASE WHEN (v_attrs->>'rolinherit')::boolean THEN 'INHERIT' ELSE 'NOINHERIT' END,
            CASE WHEN (v_attrs->>'rolsuper')::boolean THEN 'SUPERUSER' ELSE 'NOSUPERUSER' END,
            CASE WHEN (v_attrs->>'rolcreatedb')::boolean THEN 'CREATEDB' ELSE 'NOCREATEDB' END,
            CASE WHEN (v_attrs->>'rolcreaterole')::boolean THEN 'CREATEROLE' ELSE 'NOCREATEROLE' END,
            CASE WHEN (v_attrs->>'rolreplication')::boolean THEN 'REPLICATION' ELSE 'NOREPLICATION' END,
            CASE WHEN (v_attrs->>'rolbypassrls')::boolean THEN 'BYPASSRLS' ELSE 'NOBYPASSRLS' END,
            COALESCE((v_attrs->>'rolconnlimit')::integer, -1)
        );

        IF v_attrs->>'rolvaliduntil' IS NOT NULL AND v_attrs->>'rolvaliduntil' <> 'infinity' THEN
            v_sql := v_sql || format(' VALID UNTIL %L', v_attrs->>'rolvaliduntil');
        ELSE
            v_sql := v_sql || ' VALID UNTIL ''infinity''';
        END IF;

        EXECUTE v_sql;
    END IF;

    -- 7b. Restore attributes of pre-existing shared managed roles (anon, authenticated, service_role)
    SELECT data INTO v_roles_pre FROM public._healthsync_staging_manifest WHERE snapshot_key = 'roles_pre_existence';
    IF v_roles_pre IS NOT NULL THEN
        FOREACH r_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
            IF COALESCE((v_roles_pre->>(r_name || '_exists'))::boolean, false) IS TRUE 
               AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r_name) THEN
                v_attrs := v_roles_pre->(r_name || '_attributes');
                IF v_attrs IS NOT NULL THEN
                    v_sql := format('ALTER ROLE %I WITH %s %s %s %s %s %s %s CONNECTION LIMIT %s',
                        r_name,
                        CASE WHEN (v_attrs->>'rolcanlogin')::boolean THEN 'LOGIN' ELSE 'NOLOGIN' END,
                        CASE WHEN COALESCE((v_attrs->>'rolinherit')::boolean, false) THEN 'INHERIT' ELSE 'NOINHERIT' END,
                        CASE WHEN (v_attrs->>'rolsuper')::boolean THEN 'SUPERUSER' ELSE 'NOSUPERUSER' END,
                        CASE WHEN (v_attrs->>'rolcreatedb')::boolean THEN 'CREATEDB' ELSE 'NOCREATEDB' END,
                        CASE WHEN (v_attrs->>'rolcreaterole')::boolean THEN 'CREATEROLE' ELSE 'NOCREATEROLE' END,
                        CASE WHEN (v_attrs->>'rolreplication')::boolean THEN 'REPLICATION' ELSE 'NOREPLICATION' END,
                        CASE WHEN (v_attrs->>'rolbypassrls')::boolean THEN 'BYPASSRLS' ELSE 'NOBYPASSRLS' END,
                        COALESCE((v_attrs->>'rolconnlimit')::integer, -1)
                    );

                    IF v_attrs->>'rolvaliduntil' IS NOT NULL AND v_attrs->>'rolvaliduntil' <> 'infinity' THEN
                        v_sql := v_sql || format(' VALID UNTIL %L', v_attrs->>'rolvaliduntil');
                    ELSE
                        v_sql := v_sql || ' VALID UNTIL ''infinity''';
                    END IF;

                    EXECUTE v_sql;
                END IF;
            END IF;
        END LOOP;
    END IF;
END $$;

-- 8. Drop Roles Created by Script 1 (Pre-Existing Roles Are NEVER Dropped)
DO $$
DECLARE
    v_roles jsonb;
    v_runner_existed boolean;
    v_anon_existed boolean;
    v_auth_existed boolean;
    v_srv_existed boolean;
BEGIN
    SELECT data INTO v_roles 
    FROM public._healthsync_staging_manifest 
    WHERE snapshot_key = 'roles_pre_existence';

    IF v_roles IS NOT NULL THEN
        v_runner_existed := COALESCE((v_roles->>'test_runner_exists')::boolean, false);
        v_anon_existed := COALESCE((v_roles->>'anon_exists')::boolean, false);
        v_auth_existed := COALESCE((v_roles->>'authenticated_exists')::boolean, false);
        v_srv_existed := COALESCE((v_roles->>'service_role_exists')::boolean, false);

        -- Drop test runner ONLY if newly created by this staging package
        IF NOT v_runner_existed AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'healthsync_test_runner') THEN
            DROP ROLE healthsync_test_runner;
        END IF;

        -- Drop shared roles ONLY if newly created by this staging package
        IF NOT v_anon_existed AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            DROP ROLE anon;
        END IF;
        IF NOT v_auth_existed AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            DROP ROLE authenticated;
        END IF;
        IF NOT v_srv_existed AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
            DROP ROLE service_role;
        END IF;
    END IF;
END $$;

-- 9. Rigorous Post-Recovery Verification Suite
-- Directly compares actual database state against pre-deployment snapshots to ensure
-- pre-existing permissions and memberships survive and all staging changes are cleanly reversed.
DO $$
DECLARE
    v_tbl_acls jsonb;
    v_col_acls jsonb;
    v_schema_acls jsonb;
    v_memberships_pre jsonb;
    v_roles_pre jsonb;
    v_unexpected_table_grants integer;
    v_missing_table_grants integer;
    v_unexpected_col_grants integer;
    v_missing_col_grants integer;
    v_unexpected_memberships integer;
    v_missing_memberships integer;
    v_runner_attrs jsonb;
    v_attrs jsonb;
    r_name text;
BEGIN
    -- Verification 1: Verify Table Privileges against table_acls_pre snapshot
    SELECT data INTO v_tbl_acls FROM public._healthsync_staging_manifest WHERE snapshot_key = 'table_acls_pre';
    IF v_tbl_acls IS NOT NULL THEN
        -- Check for unexpected non-owner grants
        SELECT count(*) INTO v_unexpected_table_grants
        FROM information_schema.table_privileges tp
        JOIN pg_class c ON c.relname = tp.table_name
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = tp.table_schema
        WHERE tp.table_schema = 'public'
          AND tp.table_name IN ('health_modules', 'users', 'user_profiles', 'assessments', 'assessment_reports', 'refresh_tokens', 'audit_logs')
          AND tp.grantee <> c.relowner::regrole::text
          AND NOT EXISTS (
              SELECT 1 FROM jsonb_to_recordset(v_tbl_acls) AS snap(
                  grantor text, grantee text, table_name text, privilege_type text, is_grantable text
              )
              WHERE snap.table_name = tp.table_name
                AND snap.grantee = tp.grantee
                AND snap.privilege_type = tp.privilege_type
                AND snap.is_grantable = tp.is_grantable
          );

        IF v_unexpected_table_grants > 0 THEN
            RAISE EXCEPTION 'Recovery verification failed: % unexpected table privileges exist that were not in pre-deployment snapshot.', v_unexpected_table_grants;
        END IF;

        -- Check for missing non-owner grants
        SELECT count(*) INTO v_missing_table_grants
        FROM jsonb_to_recordset(v_tbl_acls) AS snap(
            grantor text, grantee text, table_name text, privilege_type text, is_grantable text
        )
        JOIN pg_class c ON c.relname = snap.table_name
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        WHERE snap.grantee <> c.relowner::regrole::text
          AND (snap.grantee = 'PUBLIC' OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = snap.grantee))
          AND NOT EXISTS (
              SELECT 1 FROM information_schema.table_privileges tp
              WHERE tp.table_schema = 'public'
                AND tp.table_name = snap.table_name
                AND tp.grantee = snap.grantee
                AND tp.privilege_type = snap.privilege_type
                AND snap.is_grantable = snap.is_grantable
          );

        IF v_missing_table_grants > 0 THEN
            RAISE EXCEPTION 'Recovery verification failed: % pre-deployment table privileges are missing after recovery.', v_missing_table_grants;
        END IF;
    END IF;

    -- Verification 2: Verify Column Privileges against column_acls_pre snapshot
    SELECT data INTO v_col_acls FROM public._healthsync_staging_manifest WHERE snapshot_key = 'column_acls_pre';
    IF v_col_acls IS NOT NULL THEN
        -- Check for unexpected column grants
        SELECT count(*) INTO v_unexpected_col_grants
        FROM information_schema.column_privileges cp
        JOIN pg_class c ON c.relname = cp.table_name
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = cp.table_schema
        WHERE cp.table_schema = 'public'
          AND cp.table_name IN ('health_modules', 'users', 'user_profiles', 'assessments', 'assessment_reports', 'refresh_tokens', 'audit_logs')
          AND cp.grantee <> c.relowner::regrole::text
          AND NOT EXISTS (
              SELECT 1 FROM jsonb_to_recordset(v_col_acls) AS snap(
                  grantor text, grantee text, table_name text, column_name text, privilege_type text, is_grantable text
              )
              WHERE snap.table_name = cp.table_name
                AND snap.column_name = cp.column_name
                AND snap.grantee = cp.grantee
                AND snap.privilege_type = cp.privilege_type
                AND snap.is_grantable = cp.is_grantable
          );

        IF v_unexpected_col_grants > 0 THEN
            RAISE EXCEPTION 'Recovery verification failed: % unexpected column privileges exist that were not in pre-deployment snapshot.', v_unexpected_col_grants;
        END IF;

        -- Check for missing column grants
        SELECT count(*) INTO v_missing_col_grants
        FROM jsonb_to_recordset(v_col_acls) AS snap(
            grantor text, grantee text, table_name text, column_name text, privilege_type text, is_grantable text
        )
        JOIN pg_class c ON c.relname = snap.table_name
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        WHERE snap.grantee <> c.relowner::regrole::text
          AND (snap.grantee = 'PUBLIC' OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = snap.grantee))
          AND NOT EXISTS (
              SELECT 1 FROM information_schema.column_privileges cp
              WHERE cp.table_schema = 'public'
                AND cp.table_name = snap.table_name
                AND cp.column_name = snap.column_name
                AND cp.grantee = snap.grantee
                AND cp.privilege_type = snap.privilege_type
                AND snap.is_grantable = snap.is_grantable
          );

        IF v_missing_col_grants > 0 THEN
            RAISE EXCEPTION 'Recovery verification failed: % pre-deployment column privileges are missing after recovery.', v_missing_col_grants;
        END IF;
    END IF;

    -- Verification 3: Verify Schema USAGE permissions against schema_acls_pre snapshot
    SELECT data INTO v_schema_acls FROM public._healthsync_staging_manifest WHERE snapshot_key = 'schema_acls_pre';
    IF v_schema_acls IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            IF has_schema_privilege('anon', 'public', 'USAGE') <> COALESCE((v_schema_acls->>'anon_had_usage')::boolean, false) THEN
                RAISE EXCEPTION 'Recovery verification failed: anon schema USAGE privilege does not match baseline.';
            END IF;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            IF has_schema_privilege('authenticated', 'public', 'USAGE') <> COALESCE((v_schema_acls->>'authenticated_had_usage')::boolean, false) THEN
                RAISE EXCEPTION 'Recovery verification failed: authenticated schema USAGE privilege does not match baseline.';
            END IF;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
            IF has_schema_privilege('service_role', 'public', 'USAGE') <> COALESCE((v_schema_acls->>'service_role_had_usage')::boolean, false) THEN
                RAISE EXCEPTION 'Recovery verification failed: service_role schema USAGE privilege does not match baseline.';
            END IF;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'healthsync_test_runner') THEN
            IF has_schema_privilege('healthsync_test_runner', 'public', 'USAGE') <> COALESCE((v_schema_acls->>'test_runner_had_usage')::boolean, false) THEN
                RAISE EXCEPTION 'Recovery verification failed: healthsync_test_runner schema USAGE privilege does not match baseline.';
            END IF;
        END IF;
    END IF;

    -- Verification 4: Verify Role Membership Parity against role_memberships_pre snapshot (Full tuple & options)
    SELECT data INTO v_memberships_pre FROM public._healthsync_staging_manifest WHERE snapshot_key = 'role_memberships_pre';
    IF v_memberships_pre IS NOT NULL THEN
        -- Check for unexpected memberships involving managed roles (full tuple: role, member, grantor, options)
        SELECT count(*) INTO v_unexpected_memberships
        FROM pg_auth_members m
        JOIN pg_roles r_group ON r_group.oid = m.roleid
        JOIN pg_roles r_member ON r_member.oid = m.member
        JOIN pg_roles r_grantor ON r_grantor.oid = m.grantor
        WHERE (r_group.rolname IN ('anon', 'authenticated', 'service_role', 'healthsync_test_runner')
               OR r_member.rolname IN ('anon', 'authenticated', 'service_role', 'healthsync_test_runner'))
          AND NOT EXISTS (
              SELECT 1 FROM jsonb_to_recordset(v_memberships_pre) AS snap(
                  role_name text, member_name text, grantor_name text, admin_option boolean, inherit_option boolean, set_option boolean
              )
              WHERE snap.role_name = r_group.rolname
                AND snap.member_name = r_member.rolname
                AND snap.grantor_name = r_grantor.rolname
                AND snap.admin_option = m.admin_option
                AND COALESCE((to_jsonb(m)->>'inherit_option')::boolean, true) = snap.inherit_option
                AND COALESCE((to_jsonb(m)->>'set_option')::boolean, true) = snap.set_option
          );

        IF v_unexpected_memberships > 0 THEN
            RAISE EXCEPTION 'Recovery verification failed: % unexpected role memberships remain active.', v_unexpected_memberships;
        END IF;

        -- Check for missing pre-existing memberships (full tuple: role, member, grantor, options)
        SELECT count(*) INTO v_missing_memberships
        FROM jsonb_to_recordset(v_memberships_pre) AS snap(
            role_name text, member_name text, grantor_name text, admin_option boolean, inherit_option boolean, set_option boolean
        )
        WHERE NOT EXISTS (
            SELECT 1 FROM pg_auth_members m
            JOIN pg_roles r_group ON r_group.oid = m.roleid
            JOIN pg_roles r_member ON r_member.oid = m.member
            JOIN pg_roles r_grantor ON r_grantor.oid = m.grantor
            WHERE r_group.rolname = snap.role_name
              AND r_member.rolname = snap.member_name
              AND r_grantor.rolname = snap.grantor_name
              AND m.admin_option = snap.admin_option
              AND COALESCE((to_jsonb(m)->>'inherit_option')::boolean, true) = snap.inherit_option
              AND COALESCE((to_jsonb(m)->>'set_option')::boolean, true) = snap.set_option
        );

        IF v_missing_memberships > 0 THEN
            RAISE EXCEPTION 'Recovery verification failed: % pre-deployment role memberships are missing after recovery.', v_missing_memberships;
        END IF;
    END IF;

    -- Verification 5: Verify Role Existence & Attributes Parity against roles_pre_existence snapshot for ALL managed roles
    SELECT data INTO v_roles_pre FROM public._healthsync_staging_manifest WHERE snapshot_key = 'roles_pre_existence';
    IF v_roles_pre IS NOT NULL THEN
        -- Verify healthsync_test_runner
        IF COALESCE((v_roles_pre->>'test_runner_exists')::boolean, false) IS TRUE THEN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'healthsync_test_runner') THEN
                RAISE EXCEPTION 'Recovery verification failed: Pre-existing healthsync_test_runner role was erroneously dropped.';
            END IF;
            SELECT data INTO v_runner_attrs FROM public._healthsync_staging_manifest WHERE snapshot_key = 'test_runner_pre_attributes';
            IF v_runner_attrs IS NOT NULL THEN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_roles r
                    WHERE r.rolname = 'healthsync_test_runner'
                      AND r.rolcanlogin = (v_runner_attrs->>'rolcanlogin')::boolean
                      AND r.rolinherit = (v_runner_attrs->>'rolinherit')::boolean
                      AND r.rolsuper = (v_runner_attrs->>'rolsuper')::boolean
                      AND r.rolcreatedb = (v_runner_attrs->>'rolcreatedb')::boolean
                      AND r.rolcreaterole = (v_runner_attrs->>'rolcreaterole')::boolean
                      AND r.rolreplication = (v_runner_attrs->>'rolreplication')::boolean
                      AND r.rolbypassrls = (v_runner_attrs->>'rolbypassrls')::boolean
                      AND r.rolconnlimit = COALESCE((v_runner_attrs->>'rolconnlimit')::integer, -1)
                      AND (v_runner_attrs ? 'rolvaliduntil')
                      AND (
                          (
                              ((v_runner_attrs->>'rolvaliduntil') IS NULL OR (v_runner_attrs->>'rolvaliduntil') = 'infinity')
                              AND (r.rolvaliduntil IS NULL OR r.rolvaliduntil = 'infinity'::timestamptz)
                          )
                          OR (
                              (v_runner_attrs->>'rolvaliduntil') IS NOT NULL
                              AND (v_runner_attrs->>'rolvaliduntil') <> 'infinity'
                              AND r.rolvaliduntil = (v_runner_attrs->>'rolvaliduntil')::timestamptz
                          )
                      )
                ) THEN
                    RAISE EXCEPTION 'Recovery verification failed: Attributes of pre-existing healthsync_test_runner do not match pre-deployment baseline.';
                END IF;
            END IF;
        ELSE
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'healthsync_test_runner') THEN
                RAISE EXCEPTION 'Recovery verification failed: Deployment-created healthsync_test_runner role was not dropped.';
            END IF;
        END IF;

        -- Verify anon
        IF COALESCE((v_roles_pre->>'anon_exists')::boolean, false) IS TRUE THEN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                RAISE EXCEPTION 'Recovery verification failed: Pre-existing anon role was erroneously dropped.';
            END IF;
        ELSE
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                RAISE EXCEPTION 'Recovery verification failed: Deployment-created anon role was not dropped.';
            END IF;
        END IF;

        -- Verify authenticated
        IF COALESCE((v_roles_pre->>'authenticated_exists')::boolean, false) IS TRUE THEN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                RAISE EXCEPTION 'Recovery verification failed: Pre-existing authenticated role was erroneously dropped.';
            END IF;
        ELSE
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                RAISE EXCEPTION 'Recovery verification failed: Deployment-created authenticated role was not dropped.';
            END IF;
        END IF;

        -- Verify service_role
        IF COALESCE((v_roles_pre->>'service_role_exists')::boolean, false) IS TRUE THEN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
                RAISE EXCEPTION 'Recovery verification failed: Pre-existing service_role role was erroneously dropped.';
            END IF;
        ELSE
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
                RAISE EXCEPTION 'Recovery verification failed: Deployment-created service_role role was not dropped.';
            END IF;
        END IF;

        -- Verify attributes of all pre-existing managed roles
        FOREACH r_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
            IF COALESCE((v_roles_pre->>(r_name || '_exists'))::boolean, false) IS TRUE THEN
                v_attrs := v_roles_pre->(r_name || '_attributes');
                IF v_attrs IS NOT NULL THEN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_roles r
                        WHERE r.rolname = r_name
                          AND r.rolcanlogin = (v_attrs->>'rolcanlogin')::boolean
                          AND r.rolinherit = COALESCE((v_attrs->>'rolinherit')::boolean, false)
                          AND r.rolsuper = (v_attrs->>'rolsuper')::boolean
                          AND r.rolcreatedb = (v_attrs->>'rolcreatedb')::boolean
                          AND r.rolcreaterole = (v_attrs->>'rolcreaterole')::boolean
                          AND r.rolreplication = (v_attrs->>'rolreplication')::boolean
                          AND r.rolbypassrls = (v_attrs->>'rolbypassrls')::boolean
                          AND r.rolconnlimit = COALESCE((v_attrs->>'rolconnlimit')::integer, -1)
                          AND (v_attrs ? 'rolvaliduntil')
                          AND (
                              (
                                  ((v_attrs->>'rolvaliduntil') IS NULL OR (v_attrs->>'rolvaliduntil') = 'infinity')
                                  AND (r.rolvaliduntil IS NULL OR r.rolvaliduntil = 'infinity'::timestamptz)
                              )
                              OR (
                                  (v_attrs->>'rolvaliduntil') IS NOT NULL
                                  AND (v_attrs->>'rolvaliduntil') <> 'infinity'
                                  AND r.rolvaliduntil = (v_attrs->>'rolvaliduntil')::timestamptz
                              )
                          )
                    ) THEN
                        RAISE EXCEPTION 'Recovery verification failed: Attributes of pre-existing role % do not match pre-deployment baseline.', r_name;
                    END IF;
                END IF;
            END IF;
        END LOOP;
    END IF;
END $$;

-- 10. Clean Up Staging Manifest Table (Guarded by deployment ownership check)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public._healthsync_staging_manifest 
        WHERE snapshot_key = 'manifest_created_by_deployment'
    ) THEN
        DROP TABLE public._healthsync_staging_manifest;
    END IF;
END $$;

-- 11. Completion Notification (Emitted strictly after every assertion passes)
DO $$
BEGIN
    RAISE NOTICE 'HealthSync AI staging roles and permissions recovery verified and completed successfully. Baseline restored.';
END $$;
