-- ============================================================================
-- HealthSync AI — Complete Staging Rollback Script
-- Engine: Neon PostgreSQL 18.6
-- Usage: psql --variable=ON_ERROR_STOP=1 --single-transaction -f staging_rollback.sql
-- ============================================================================

\set ON_ERROR_STOP on

-- 1. Pre-Flight Safety Checks (Must execute before ANY database mutations)
-- Verifies manifest table, deployment provenance, baseline snapshots, and exact grantor invariants.
DO $$
DECLARE
    v_missing text;
    v_tbl_acls jsonb;
    v_col_acls jsonb;
    v_fn jsonb;
    v_memberships_pre jsonb;
    r RECORD;
BEGIN
    -- Check 1a: Manifest table must exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = '_healthsync_staging_manifest'
    ) THEN
        RAISE EXCEPTION 'Rollback failed: public._healthsync_staging_manifest does not exist. Cannot safely restore pre-deployment baseline without recorded manifest.';
    END IF;

    -- Check 1b: Manifest must have been created by this deployment
    IF NOT EXISTS (
        SELECT 1 FROM public._healthsync_staging_manifest WHERE snapshot_key = 'manifest_created_by_deployment'
    ) THEN
        RAISE EXCEPTION 'Rollback failed: manifest_created_by_deployment key not found in manifest. Refusing to operate on an unrecognized manifest table.';
    END IF;

    -- Check 1c: All required baseline snapshot keys must exist
    SELECT string_agg(k, ', ') INTO v_missing
    FROM unnest(ARRAY[
        'roles_pre_existence',
        'role_memberships_pre',
        'test_runner_pre_attributes',
        'schema_acls_pre',
        'table_acls_pre',
        'column_acls_pre',
        'rls_flags_pre',
        'policies_pre',
        'function_auth_is_admin_pre',
        'indexes_gin_pre'
    ]) AS k
    WHERE NOT EXISTS (
        SELECT 1 FROM public._healthsync_staging_manifest WHERE snapshot_key = k
    );

    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'Rollback failed: Required baseline snapshot keys missing from manifest: %. Safe restoration cannot be guaranteed. Aborting before mutation.', v_missing;
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
            RAISE EXCEPTION 'Rollback pre-flight failed: Snapshot table grant on % to % has grantor % (owner is %, executing user is %). Executing user lacks authorization to restore grant under original grantor identity. PostgreSQL cannot guarantee exact grantor restoration upon rollback. Aborting before mutation.',
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
            RAISE EXCEPTION 'Rollback pre-flight failed: Snapshot column grant on %.% to % has grantor % (owner is %, executing user is %). Exact grantor restoration cannot be guaranteed. Aborting before mutation.',
                r.table_name, r.column_name, r.grantee, r.grantor, r.table_owner, r.exec_user;
        END LOOP;
    END IF;

    -- Check 1f: Verify function_auth_is_admin_pre grantor restoration invariant
    SELECT data INTO v_fn FROM public._healthsync_staging_manifest WHERE snapshot_key = 'function_auth_is_admin_pre';
    IF v_fn IS NOT NULL AND COALESCE((v_fn->>'existed')::boolean, false) IS TRUE AND v_fn->'privileges' IS NOT NULL THEN
        FOR r IN 
            SELECT snap.grantee, snap.grantor, v_fn->>'owner' AS fn_owner, current_user::text AS exec_user
            FROM jsonb_to_recordset(v_fn->'privileges') AS snap(grantor text, grantee text, privilege_type text, is_grantable text)
            WHERE snap.grantee <> (v_fn->>'owner')
              AND (
                  snap.grantor <> (v_fn->>'owner')
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
            RAISE EXCEPTION 'Rollback pre-flight failed: Snapshot routine grant on public.auth_is_admin() to % has grantor % (owner is %, executing user is %). Exact grantor restoration cannot be guaranteed. Aborting before mutation.',
                r.grantee, r.grantor, r.fn_owner, r.exec_user;
        END LOOP;
    END IF;

    -- Check 1g: Verify role_memberships_pre grantor restoration invariant & GRANTED BY support
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
                RAISE EXCEPTION 'Rollback pre-flight failed: Cannot safely restore membership % -> % with original grantor % because executing user % lacks superuser or ADMIN OPTION on grantor. PostgreSQL GRANTED BY semantics cannot be satisfied. Aborting before mutation.',
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
            RAISE EXCEPTION 'Rollback pre-flight failed: Cannot safely revoke deployment membership % -> % with grantor % because executing user % lacks superuser or ADMIN OPTION on grantor. Aborting before mutation.',
                r.role_name, r.member_name, r.grantor_name, r.executing_user;
        END LOOP;
    END IF;
END $$;

-- 2. Drop Staging Policies Created by Deployment (Pre-existing policies are preserved)
DO $$
DECLARE
    v_policies_pre jsonb;
    pol_name text;
    tab_name text;
    staging_policies CONSTANT text[][] := ARRAY[
        ARRAY['users', 'user_read_own'],
        ARRAY['users', 'user_insert_registration'],
        ARRAY['users', 'user_update_own'],
        ARRAY['users', 'service_role_users_all'],
        ARRAY['user_profiles', 'profile_read_own'],
        ARRAY['user_profiles', 'profile_insert_own'],
        ARRAY['user_profiles', 'profile_update_own'],
        ARRAY['user_profiles', 'service_role_profiles_all'],
        ARRAY['assessments', 'assessment_read_own'],
        ARRAY['assessments', 'assessment_insert_own'],
        ARRAY['assessments', 'assessment_update_own'],
        ARRAY['assessments', 'service_role_assessments_all'],
        ARRAY['assessment_reports', 'reports_read_own'],
        ARRAY['assessment_reports', 'reports_insert_own'],
        ARRAY['assessment_reports', 'service_role_reports_all'],
        ARRAY['refresh_tokens', 'refresh_tokens_own'],
        ARRAY['refresh_tokens', 'service_role_tokens_all'],
        ARRAY['audit_logs', 'audit_logs_insert'],
        ARRAY['audit_logs', 'audit_logs_admin_only'],
        ARRAY['audit_logs', 'service_role_audit_all']
    ];
    i integer;
BEGIN
    SELECT data INTO v_policies_pre FROM public._healthsync_staging_manifest WHERE snapshot_key = 'policies_pre';

    FOR i IN 1..array_length(staging_policies, 1) LOOP
        tab_name := staging_policies[i][1];
        pol_name := staging_policies[i][2];

        -- Drop policy ONLY if it was not present in the pre-deployment snapshot
        IF NOT EXISTS (
            SELECT 1 FROM jsonb_to_recordset(v_policies_pre) AS snap(schemaname text, tablename text, policyname text)
            WHERE snap.schemaname = 'public' AND snap.tablename = tab_name AND snap.policyname = pol_name
        ) THEN
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_name, tab_name);
        END IF;
    END LOOP;
END $$;

-- 3. Restore Pre-Existing Policies (Exact PERMISSIVE/RESTRICTIVE & PUBLIC Role Fidelity)
DO $$
DECLARE
    p RECORD;
    v_policies jsonb;
    v_roles_str text;
    v_permissive_str text;
    v_sql text;
    v_curr_def RECORD;
    v_needs_restore boolean;
BEGIN
    SELECT data INTO v_policies 
    FROM public._healthsync_staging_manifest 
    WHERE snapshot_key = 'policies_pre';

    IF v_policies IS NOT NULL AND jsonb_array_length(v_policies) > 0 THEN
        FOR p IN SELECT * FROM jsonb_to_recordset(v_policies) AS (
            schemaname text, tablename text, policyname text, permissive text, roles text[], cmd text, qual text, with_check text
        ) LOOP
            v_needs_restore := false;

            -- Inspect whether the policy currently exists and if its definition matches
            SELECT permissive, roles, cmd, qual, with_check
            INTO v_curr_def
            FROM pg_policies
            WHERE schemaname = p.schemaname AND tablename = p.tablename AND policyname = p.policyname;

            IF NOT FOUND THEN
                v_needs_restore := true;
            ELSE
                IF v_curr_def.permissive <> p.permissive
                   OR v_curr_def.cmd <> p.cmd
                   OR v_curr_def.qual IS DISTINCT FROM p.qual
                   OR v_curr_def.with_check IS DISTINCT FROM p.with_check
                   OR NOT (
                       v_curr_def.roles = p.roles
                       OR (array_length(v_curr_def.roles, 1) = 1 AND v_curr_def.roles[1] = 'public' AND (p.roles IS NULL OR p.roles = ARRAY['public'::text]))
                   ) THEN
                    -- Modified by deployment; drop modified definition before recreating original
                    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
                    v_needs_restore := true;
                END IF;
            END IF;

            IF v_needs_restore THEN
                SELECT string_agg(
                    CASE 
                        WHEN lower(r) = 'public' THEN 'PUBLIC'
                        ELSE quote_ident(r)
                    END, 
                    ', '
                ) INTO v_roles_str 
                FROM unnest(p.roles) AS r;

                IF v_roles_str IS NULL OR v_roles_str = '' THEN
                    v_roles_str := 'PUBLIC';
                END IF;

                IF p.permissive IS NOT NULL AND upper(p.permissive) = 'RESTRICTIVE' THEN
                    v_permissive_str := 'AS RESTRICTIVE';
                ELSE
                    v_permissive_str := 'AS PERMISSIVE';
                END IF;

                v_sql := format('CREATE POLICY %I ON %I.%I %s FOR %s TO %s', 
                                p.policyname, p.schemaname, p.tablename, v_permissive_str, p.cmd, v_roles_str);
                IF p.qual IS NOT NULL THEN
                    v_sql := v_sql || format(' USING (%s)', p.qual);
                END IF;
                IF p.with_check IS NOT NULL THEN
                    v_sql := v_sql || format(' WITH CHECK (%s)', p.with_check);
                END IF;
                EXECUTE v_sql;
            END IF;
        END LOOP;
    END IF;
END $$;

-- 4. Restore Pre-Deployment Table RLS & Force Flags
DO $$
DECLARE
    r RECORD;
    v_flags jsonb;
BEGIN
    SELECT data INTO v_flags 
    FROM public._healthsync_staging_manifest 
    WHERE snapshot_key = 'rls_flags_pre';

    IF v_flags IS NOT NULL THEN
        FOR r IN SELECT * FROM jsonb_to_recordset(v_flags) AS (
            table_name text, relrowsecurity boolean, relforcerowsecurity boolean
        ) LOOP
            -- Restore relforcerowsecurity
            IF r.relforcerowsecurity IS FALSE THEN
                EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', r.table_name);
            ELSIF r.relforcerowsecurity IS TRUE THEN
                EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.table_name);
            END IF;

            -- Restore relrowsecurity
            IF r.relrowsecurity IS FALSE THEN
                EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', r.table_name);
            ELSIF r.relrowsecurity IS TRUE THEN
                EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);
            END IF;
        END LOOP;
    END IF;
END $$;

-- 5. Restore Complete Original auth_is_admin() State by Exact Zero-Argument Signature
DO $$
DECLARE
    v_fn jsonb;
    v_existed boolean;
    v_def text;
    v_owner text;
    v_privs jsonb;
    priv_rec RECORD;
    v_target text;
    v_sql text;
BEGIN
    SELECT data INTO v_fn 
    FROM public._healthsync_staging_manifest 
    WHERE snapshot_key = 'function_auth_is_admin_pre';

    IF v_fn IS NOT NULL AND COALESCE((v_fn->>'existed')::boolean, false) IS TRUE THEN
        v_def := v_fn->>'def';
        v_owner := v_fn->>'owner';
        v_privs := v_fn->'privileges';

        -- 1. Restore original function definition
        IF v_def IS NOT NULL THEN
            EXECUTE v_def;
        END IF;

        -- 2. Restore original owner on exact zero-argument signature
        IF v_owner IS NOT NULL AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_owner) THEN
            EXECUTE format('ALTER FUNCTION public.auth_is_admin() OWNER TO %I', v_owner);
        END IF;

        -- 3. Reset function ACLs before re-applying original routine privileges (No CASCADE)
        REVOKE ALL ON FUNCTION public.auth_is_admin() FROM PUBLIC, anon, authenticated, service_role;

        -- 4. Restore original routine privileges
        IF v_privs IS NOT NULL AND jsonb_array_length(v_privs) > 0 THEN
            FOR priv_rec IN SELECT * FROM jsonb_to_recordset(v_privs) AS (
                grantor text, grantee text, privilege_type text, is_grantable text
            ) LOOP
                IF priv_rec.grantee = 'PUBLIC' THEN
                    v_target := 'PUBLIC';
                ELSIF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = priv_rec.grantee) THEN
                    v_target := quote_ident(priv_rec.grantee);
                ELSE
                    CONTINUE;
                END IF;

                v_sql := format('GRANT %s ON FUNCTION public.auth_is_admin() TO %s', priv_rec.privilege_type, v_target);
                IF priv_rec.is_grantable = 'YES' THEN
                    v_sql := v_sql || ' WITH GRANT OPTION';
                END IF;
                EXECUTE v_sql;
            END LOOP;
        END IF;
    ELSE
        -- Function did not previously exist: drop only the exact zero-argument function created by this deployment
        DROP FUNCTION IF EXISTS public.auth_is_admin();
    END IF;
END $$;

-- 6. Restore or Drop GIN Indexes
DO $$
DECLARE
    v_idx jsonb;
    v_bio_existed boolean;
    v_shap_existed boolean;
BEGIN
    SELECT data INTO v_idx 
    FROM public._healthsync_staging_manifest 
    WHERE snapshot_key = 'indexes_gin_pre';

    IF v_idx IS NOT NULL THEN
        v_bio_existed := COALESCE((v_idx->>'biomarkers_existed')::boolean, false);
        v_shap_existed := COALESCE((v_idx->>'shap_existed')::boolean, false);

        IF NOT v_bio_existed THEN
            DROP INDEX IF EXISTS public.idx_assessments_gin_biomarkers;
        END IF;
        IF NOT v_shap_existed THEN
            DROP INDEX IF EXISTS public.idx_assessments_gin_shap;
        END IF;
    ELSE
        DROP INDEX IF EXISTS public.idx_assessments_gin_biomarkers;
        DROP INDEX IF EXISTS public.idx_assessments_gin_shap;
    END IF;
END $$;

-- 7. Actively Restore Exact Pre-Deployment Column ACLs from column_acls_pre Snapshot
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
        -- 7a. Revoke any column grants currently present that were NOT in the pre-deployment snapshot (No CASCADE)
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

        -- 7b. Re-grant any column grants from pre-deployment snapshot that are currently missing
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

-- 8. Actively Restore Exact Pre-Deployment Table ACLs from table_acls_pre Snapshot
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
        -- 8a. Revoke any table grants currently present that were NOT in the pre-deployment snapshot (No CASCADE)
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

        -- 8b. Re-grant any table grants from pre-deployment snapshot that are currently missing
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

-- 9. Actively Restore Exact Pre-Deployment Schema USAGE Permissions from schema_acls_pre Snapshot
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

-- 10. Actively Reconcile & Restore Exact Role Memberships (Full Tuple: role_name, member_name, grantor_name)
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
        -- 10a. Revoke any membership tuple (role_name, member_name, grantor_name)
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

        -- 10b. Re-grant and restore exact options and grantor identity for every pre-existing membership
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

-- 11. Restore Attributes of Pre-Existing Managed Roles & healthsync_test_runner
DO $$
DECLARE
    v_attrs jsonb;
    v_roles_pre jsonb;
    v_sql text;
    r_name text;
BEGIN
    -- 11a. Restore healthsync_test_runner attributes
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

    -- 11b. Restore attributes of pre-existing shared managed roles (anon, authenticated, service_role)
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

-- 12. Drop Roles Created by Staging Deployment (Pre-Existing Roles Are NEVER Dropped)
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

-- 13. Rigorous Post-Rollback Verification Suite
-- Directly compares actual database state against pre-deployment snapshots to ensure
-- pre-existing permissions and role memberships survive and all staging changes are cleanly reversed.
DO $$
DECLARE
    v_residual_policies integer;
    v_fn_snapshot jsonb;
    v_fn_existed boolean;
    v_fn_owner text;
    v_current_fn_owner text;
    v_idx_snapshot jsonb;
    v_bio_existed boolean;
    v_shap_existed boolean;
    r RECORD;
    v_flags jsonb;
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
    -- Verification 1: Ensure zero residual staging policies remain on managed tables
    SELECT data INTO v_flags FROM public._healthsync_staging_manifest WHERE snapshot_key = 'policies_pre';
    SELECT count(*) INTO v_residual_policies
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename IN ('health_modules', 'users', 'user_profiles', 'assessments', 'assessment_reports', 'refresh_tokens', 'audit_logs')
      AND NOT EXISTS (
          SELECT 1 FROM jsonb_to_recordset(v_flags) AS snap(
              schemaname text, tablename text, policyname text
          )
          WHERE snap.schemaname = p.schemaname 
            AND snap.tablename = p.tablename 
            AND snap.policyname = p.policyname
      );
    IF v_residual_policies > 0 THEN
        RAISE EXCEPTION 'Rollback verification failed: % residual staging policies remain active in public schema.', v_residual_policies;
    END IF;

    -- Verification 2: Verify all pre-existing policies match policies_pre snapshot exactly (complete definitions, not merely names)
    IF v_flags IS NOT NULL AND jsonb_array_length(v_flags) > 0 THEN
        FOR r IN SELECT * FROM jsonb_to_recordset(v_flags) AS (
            schemaname text, tablename text, policyname text, permissive text, roles text[], cmd text, qual text, with_check text
        ) LOOP
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies p
                WHERE p.schemaname = r.schemaname 
                  AND p.tablename = r.tablename 
                  AND p.policyname = r.policyname
                  AND p.permissive = r.permissive
                  AND p.cmd = r.cmd
                  AND (
                      p.roles = r.roles 
                      OR (array_length(p.roles, 1) = 1 AND p.roles[1] = 'public' AND (r.roles IS NULL OR r.roles = ARRAY['public'::text]))
                  )
                  AND p.qual IS NOT DISTINCT FROM r.qual
                  AND p.with_check IS NOT DISTINCT FROM r.with_check
            ) THEN
                RAISE EXCEPTION 'Rollback verification failed: Pre-existing policy % on %.% is missing or its definition (cmd, permissive, roles, qual, with_check) does not match pre-deployment baseline.', r.policyname, r.schemaname, r.tablename;
            END IF;
        END LOOP;
    END IF;

    -- Verification 3: Verify RLS and FORCE flags match pre-deployment baseline exactly
    SELECT data INTO v_flags FROM public._healthsync_staging_manifest WHERE snapshot_key = 'rls_flags_pre';
    IF v_flags IS NOT NULL THEN
        FOR r IN SELECT * FROM jsonb_to_recordset(v_flags) AS (table_name text, relrowsecurity boolean, relforcerowsecurity boolean) LOOP
            IF NOT EXISTS (
                SELECT 1 FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = r.table_name
                  AND c.relrowsecurity = r.relrowsecurity
                  AND c.relforcerowsecurity = r.relforcerowsecurity
            ) THEN
                RAISE EXCEPTION 'Rollback verification failed: Table % RLS flags do not match pre-deployment baseline.', r.table_name;
            END IF;
        END LOOP;
    END IF;

    -- Verification 4: Verify auth_is_admin() state and routine privileges
    SELECT data INTO v_fn_snapshot FROM public._healthsync_staging_manifest WHERE snapshot_key = 'function_auth_is_admin_pre';
    IF v_fn_snapshot IS NOT NULL THEN
        v_fn_existed := COALESCE((v_fn_snapshot->>'existed')::boolean, false);
        v_fn_owner := v_fn_snapshot->>'owner';

        IF NOT v_fn_existed AND EXISTS (
            SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'auth_is_admin' AND p.pronargs = 0
        ) THEN
            RAISE EXCEPTION 'Rollback verification failed: public.auth_is_admin() function was not dropped.';
        END IF;

        IF v_fn_existed THEN
            SELECT p.proowner::regrole::text INTO v_current_fn_owner
            FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'auth_is_admin' AND p.pronargs = 0;

            IF v_current_fn_owner IS DISTINCT FROM v_fn_owner THEN
                RAISE EXCEPTION 'Rollback verification failed: public.auth_is_admin() owner % does not match baseline %.',
                    v_current_fn_owner, v_fn_owner;
            END IF;

            -- Verify function definition matches snapshot
            IF v_fn_snapshot->>'def' IS NOT NULL THEN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                    WHERE n.nspname = 'public' AND p.proname = 'auth_is_admin' AND p.pronargs = 0
                      AND pg_get_functiondef(p.oid) = (v_fn_snapshot->>'def')
                ) THEN
                    RAISE EXCEPTION 'Rollback verification failed: public.auth_is_admin() function definition does not match pre-deployment baseline.';
                END IF;
            END IF;

            -- Verify routine privileges match snapshot
            IF v_fn_snapshot->'privileges' IS NOT NULL THEN
                IF EXISTS (
                    SELECT 1 FROM information_schema.routine_privileges rp
                    WHERE rp.routine_schema = 'public' AND rp.routine_name = 'auth_is_admin'
                      AND rp.grantee <> v_fn_owner
                      AND NOT EXISTS (
                          SELECT 1 FROM jsonb_to_recordset(v_fn_snapshot->'privileges') AS snap(
                              grantor text, grantee text, privilege_type text, is_grantable text
                          )
                          WHERE snap.grantee = rp.grantee
                            AND snap.privilege_type = rp.privilege_type
                            AND snap.is_grantable = rp.is_grantable
                      )
                ) THEN
                    RAISE EXCEPTION 'Rollback verification failed: public.auth_is_admin() has unexpected routine privileges not present in pre-deployment snapshot.';
                END IF;

                IF EXISTS (
                    SELECT 1 FROM jsonb_to_recordset(v_fn_snapshot->'privileges') AS snap(
                        grantor text, grantee text, privilege_type text, is_grantable text
                    )
                    WHERE snap.grantee <> v_fn_owner
                      AND (snap.grantee = 'PUBLIC' OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = snap.grantee))
                      AND NOT EXISTS (
                          SELECT 1 FROM information_schema.routine_privileges rp
                          WHERE rp.routine_schema = 'public' AND rp.routine_name = 'auth_is_admin'
                            AND rp.grantee = snap.grantee
                            AND rp.privilege_type = snap.privilege_type
                            AND rp.is_grantable = snap.is_grantable
                      )
                ) THEN
                    RAISE EXCEPTION 'Rollback verification failed: public.auth_is_admin() is missing routine privileges recorded in pre-deployment snapshot.';
                END IF;
            END IF;
        END IF;
    END IF;

    -- Verification 5: Verify GIN indexes
    SELECT data INTO v_idx_snapshot FROM public._healthsync_staging_manifest WHERE snapshot_key = 'indexes_gin_pre';
    IF v_idx_snapshot IS NOT NULL THEN
        v_bio_existed := COALESCE((v_idx_snapshot->>'biomarkers_existed')::boolean, false);
        v_shap_existed := COALESCE((v_idx_snapshot->>'shap_existed')::boolean, false);

        IF NOT v_bio_existed AND EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_assessments_gin_biomarkers') THEN
            RAISE EXCEPTION 'Rollback verification failed: idx_assessments_gin_biomarkers index was not dropped.';
        END IF;
        IF NOT v_shap_existed AND EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_assessments_gin_shap') THEN
            RAISE EXCEPTION 'Rollback verification failed: idx_assessments_gin_shap index was not dropped.';
        END IF;
    END IF;

    -- Verification 6: Verify Table Privileges against table_acls_pre snapshot
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
            RAISE EXCEPTION 'Rollback verification failed: % unexpected table privileges exist that were not in pre-deployment snapshot.', v_unexpected_table_grants;
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
                AND tp.is_grantable = snap.is_grantable
          );

        IF v_missing_table_grants > 0 THEN
            RAISE EXCEPTION 'Rollback verification failed: % pre-deployment table privileges are missing after rollback.', v_missing_table_grants;
        END IF;
    END IF;

    -- Verification 7: Verify Column Privileges against column_acls_pre snapshot
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
            RAISE EXCEPTION 'Rollback verification failed: % unexpected column privileges exist that were not in pre-deployment snapshot.', v_unexpected_col_grants;
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
            RAISE EXCEPTION 'Rollback verification failed: % pre-deployment column privileges are missing after rollback.', v_missing_col_grants;
        END IF;
    END IF;

    -- Verification 8: Verify Schema USAGE permissions against schema_acls_pre snapshot
    SELECT data INTO v_schema_acls FROM public._healthsync_staging_manifest WHERE snapshot_key = 'schema_acls_pre';
    IF v_schema_acls IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            IF has_schema_privilege('anon', 'public', 'USAGE') <> COALESCE((v_schema_acls->>'anon_had_usage')::boolean, false) THEN
                RAISE EXCEPTION 'Rollback verification failed: anon schema USAGE privilege does not match baseline.';
            END IF;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            IF has_schema_privilege('authenticated', 'public', 'USAGE') <> COALESCE((v_schema_acls->>'authenticated_had_usage')::boolean, false) THEN
                RAISE EXCEPTION 'Rollback verification failed: authenticated schema USAGE privilege does not match baseline.';
            END IF;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
            IF has_schema_privilege('service_role', 'public', 'USAGE') <> COALESCE((v_schema_acls->>'service_role_had_usage')::boolean, false) THEN
                RAISE EXCEPTION 'Rollback verification failed: service_role schema USAGE privilege does not match baseline.';
            END IF;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'healthsync_test_runner') THEN
            IF has_schema_privilege('healthsync_test_runner', 'public', 'USAGE') <> COALESCE((v_schema_acls->>'test_runner_had_usage')::boolean, false) THEN
                RAISE EXCEPTION 'Rollback verification failed: healthsync_test_runner schema USAGE privilege does not match baseline.';
            END IF;
        END IF;
    END IF;

    -- Verification 9: Verify Role Membership Parity against role_memberships_pre snapshot (Full tuple & options)
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
            RAISE EXCEPTION 'Rollback verification failed: % unexpected role memberships remain active.', v_unexpected_memberships;
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
            RAISE EXCEPTION 'Rollback verification failed: % pre-deployment role memberships are missing after rollback.', v_missing_memberships;
        END IF;
    END IF;

    -- Verification 10: Verify Role Existence & Attributes Parity against roles_pre_existence snapshot for ALL managed roles
    SELECT data INTO v_roles_pre FROM public._healthsync_staging_manifest WHERE snapshot_key = 'roles_pre_existence';
    IF v_roles_pre IS NOT NULL THEN
        -- Verify healthsync_test_runner
        IF COALESCE((v_roles_pre->>'test_runner_exists')::boolean, false) IS TRUE THEN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'healthsync_test_runner') THEN
                RAISE EXCEPTION 'Rollback verification failed: Pre-existing healthsync_test_runner role was erroneously dropped.';
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
                    RAISE EXCEPTION 'Rollback verification failed: Attributes of pre-existing healthsync_test_runner do not match pre-deployment baseline.';
                END IF;
            END IF;
        ELSE
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'healthsync_test_runner') THEN
                RAISE EXCEPTION 'Rollback verification failed: Deployment-created healthsync_test_runner role was not dropped.';
            END IF;
        END IF;

        -- Verify anon
        IF COALESCE((v_roles_pre->>'anon_exists')::boolean, false) IS TRUE THEN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                RAISE EXCEPTION 'Rollback verification failed: Pre-existing anon role was erroneously dropped.';
            END IF;
        ELSE
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                RAISE EXCEPTION 'Rollback verification failed: Deployment-created anon role was not dropped.';
            END IF;
        END IF;

        -- Verify authenticated
        IF COALESCE((v_roles_pre->>'authenticated_exists')::boolean, false) IS TRUE THEN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                RAISE EXCEPTION 'Rollback verification failed: Pre-existing authenticated role was erroneously dropped.';
            END IF;
        ELSE
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                RAISE EXCEPTION 'Rollback verification failed: Deployment-created authenticated role was not dropped.';
            END IF;
        END IF;

        -- Verify service_role
        IF COALESCE((v_roles_pre->>'service_role_exists')::boolean, false) IS TRUE THEN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
                RAISE EXCEPTION 'Rollback verification failed: Pre-existing service_role role was erroneously dropped.';
            END IF;
        ELSE
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
                RAISE EXCEPTION 'Rollback verification failed: Deployment-created service_role role was not dropped.';
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
                        RAISE EXCEPTION 'Rollback verification failed: Attributes of pre-existing role % do not match pre-deployment baseline.', r_name;
                    END IF;
                END IF;
            END IF;
        END LOOP;
    END IF;
END $$;

-- 14. Clean Up Staging Manifest Table (Guarded by deployment ownership check)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public._healthsync_staging_manifest 
        WHERE snapshot_key = 'manifest_created_by_deployment'
    ) THEN
        DROP TABLE public._healthsync_staging_manifest;
    END IF;
END $$;

-- 15. Completion Notification (Emitted strictly after every assertion passes)
DO $$
BEGIN
    RAISE NOTICE 'HealthSync AI staging rollback verified and completed successfully. All pre-deployment states, ACLs, functions, and flags restored.';
END $$;
