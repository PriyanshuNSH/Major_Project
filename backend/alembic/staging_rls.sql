-- ============================================================================
-- HealthSync AI — Hardened Row Level Security (RLS) Policies
-- Engine: Neon PostgreSQL 18.6
-- Usage: psql --variable=ON_ERROR_STOP=1 --single-transaction -f staging_rls.sql
-- ============================================================================

\set ON_ERROR_STOP on

-- 1. Prerequisite Check: Ensure Manifest Table Exists & Script 1 Was Applied
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = '_healthsync_staging_manifest'
    ) OR NOT EXISTS (
        SELECT 1 FROM public._healthsync_staging_manifest 
        WHERE snapshot_key = 'script_1_applied'
    ) OR NOT EXISTS (
        SELECT 1 FROM public._healthsync_staging_manifest 
        WHERE snapshot_key = 'manifest_created_by_deployment'
    ) THEN
        RAISE EXCEPTION 'Prerequisite check failed: staging_roles_and_permissions.sql has not been successfully applied. Aborting.';
    END IF;
END $$;

-- 2. Pre-Flight Verification: Function Overload, Identity & Exact Grantor Safety
-- Detect ambiguous or unexpected overloads of auth_is_admin and verify that any pre-existing
-- function ACLs have grantor = function_owner so exact grantor identity can be restored upon rollback.
DO $$
DECLARE
    v_overload_count integer;
    v_sig text;
    r RECORD;
    v_owner text;
BEGIN
    SELECT count(*) INTO v_overload_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'auth_is_admin';

    IF v_overload_count > 1 THEN
        RAISE EXCEPTION 'Safety check failed: Multiple overloads of public.auth_is_admin detected (% overloads). Ambiguous function signature cannot be safely managed. Aborting before mutation.', v_overload_count;
    ELSIF v_overload_count = 1 THEN
        SELECT pg_get_function_identity_arguments(p.oid), p.proowner::regrole::text
        INTO v_sig, v_owner
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'auth_is_admin';

        IF v_sig <> '' THEN
            RAISE EXCEPTION 'Safety check failed: Pre-existing public.auth_is_admin has unexpected arguments: "(%)". Expected exact zero-argument signature "public.auth_is_admin()". Aborting before mutation.', v_sig;
        END IF;

        -- Verify no pre-existing routine grants have foreign grantors or grant options held by staging roles
        FOR r IN 
            SELECT rp.grantor, rp.grantee, rp.privilege_type, rp.is_grantable
            FROM information_schema.routine_privileges rp
            WHERE rp.routine_schema = 'public' 
              AND rp.routine_name = 'auth_is_admin'
        LOOP
            IF r.grantor <> v_owner THEN
                RAISE EXCEPTION 'Safety check failed: Pre-existing public.auth_is_admin() has grant to % with foreign grantor % (function owner is %). PostgreSQL cannot guarantee exact grantor restoration upon rollback. Aborting before mutation.',
                    r.grantee, r.grantor, v_owner;
            END IF;
            IF r.grantee IN ('anon', 'authenticated', 'service_role', 'healthsync_test_runner') AND r.is_grantable = 'YES' THEN
                RAISE EXCEPTION 'Safety check failed: Pre-existing public.auth_is_admin() has grant option held by staging role %. Dependent grant chains cannot be safely restored. Aborting before mutation.',
                    r.grantee;
            END IF;
        END LOOP;
    END IF;
END $$;

-- 3. Snapshot Complete Pre-Existing Function State by Exact Signature
INSERT INTO public._healthsync_staging_manifest (phase, snapshot_key, data)
SELECT
    'functions',
    'function_auth_is_admin_pre',
    jsonb_build_object(
        'existed', (p.oid IS NOT NULL),
        'identity', 'public.auth_is_admin()',
        'pronargs', 0,
        'def', CASE WHEN p.oid IS NOT NULL THEN pg_get_functiondef(p.oid) ELSE NULL END,
        'owner', CASE WHEN p.oid IS NOT NULL THEN p.proowner::regrole::text ELSE NULL END,
        'privileges', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'grantor', rp.grantor,
                'grantee', rp.grantee,
                'privilege_type', rp.privilege_type,
                'is_grantable', rp.is_grantable
            )), '[]'::jsonb)
            FROM information_schema.routine_privileges rp
            WHERE rp.routine_schema = 'public' 
              AND rp.routine_name = 'auth_is_admin'
              AND rp.specific_name = (
                  SELECT r.specific_name FROM information_schema.routines r
                  WHERE r.routine_schema = 'public' AND r.routine_name = 'auth_is_admin'
                  LIMIT 1
              )
        )
    )
FROM (SELECT 1) dummy
LEFT JOIN pg_proc p ON p.proname = 'auth_is_admin' 
                   AND p.pronamespace = 'public'::regnamespace 
                   AND p.pronargs = 0;

-- 4. Snapshot Pre-Existing GIN Indexes
INSERT INTO public._healthsync_staging_manifest (phase, snapshot_key, data)
VALUES (
    'indexes',
    'indexes_gin_pre',
    jsonb_build_object(
        'biomarkers_existed', EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_assessments_gin_biomarkers'),
        'shap_existed', EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_assessments_gin_shap')
    )
);

-- 5. Record Objects Managed by Script 2 in Manifest
INSERT INTO public._healthsync_staging_manifest (phase, snapshot_key, data)
VALUES (
    'deployment_tracking',
    'script_2_objects',
    jsonb_build_object(
        'function_created', 'public.auth_is_admin()',
        'indexes_created', jsonb_build_array('idx_assessments_gin_biomarkers', 'idx_assessments_gin_shap'),
        'policies_created', jsonb_build_array(
            jsonb_build_object('table', 'users', 'policy', 'user_read_own'),
            jsonb_build_object('table', 'users', 'policy', 'user_insert_registration'),
            jsonb_build_object('table', 'users', 'policy', 'user_update_own'),
            jsonb_build_object('table', 'users', 'policy', 'service_role_users_all'),
            jsonb_build_object('table', 'user_profiles', 'policy', 'profile_read_own'),
            jsonb_build_object('table', 'user_profiles', 'policy', 'profile_insert_own'),
            jsonb_build_object('table', 'user_profiles', 'policy', 'profile_update_own'),
            jsonb_build_object('table', 'user_profiles', 'policy', 'service_role_profiles_all'),
            jsonb_build_object('table', 'assessments', 'policy', 'assessment_read_own'),
            jsonb_build_object('table', 'assessments', 'policy', 'assessment_insert_own'),
            jsonb_build_object('table', 'assessments', 'policy', 'assessment_update_own'),
            jsonb_build_object('table', 'assessments', 'policy', 'service_role_assessments_all'),
            jsonb_build_object('table', 'assessment_reports', 'policy', 'reports_read_own'),
            jsonb_build_object('table', 'assessment_reports', 'policy', 'reports_insert_own'),
            jsonb_build_object('table', 'assessment_reports', 'policy', 'service_role_reports_all'),
            jsonb_build_object('table', 'refresh_tokens', 'policy', 'refresh_tokens_own'),
            jsonb_build_object('table', 'refresh_tokens', 'policy', 'service_role_tokens_all'),
            jsonb_build_object('table', 'audit_logs', 'policy', 'audit_logs_insert'),
            jsonb_build_object('table', 'audit_logs', 'policy', 'audit_logs_admin_only'),
            jsonb_build_object('table', 'audit_logs', 'policy', 'service_role_audit_all')
        )
    )
);

-- 6. Helper Function: Non-Recursive Admin Evaluation (Zero-Argument Signature)
-- Owned by neondb_owner (which holds BYPASSRLS=true, preventing RLS recursion on public.users)
CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = (
            CASE 
                WHEN current_setting('request.jwt.claim.sub', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN current_setting('request.jwt.claim.sub', true)::uuid
                ELSE NULL 
            END
        )
        AND role = 'admin'
        AND is_active = true
        AND deleted_at IS NULL
    );
$$;

ALTER FUNCTION public.auth_is_admin() OWNER TO neondb_owner;

REVOKE ALL ON FUNCTION public.auth_is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.auth_is_admin() TO authenticated, service_role;

-- 7. Enable & Force RLS Across All 6 Protected Tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.assessment_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_reports FORCE ROW LEVEL SECURITY;

ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens FORCE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

-- 8. Policies for `users` Table
DROP POLICY IF EXISTS user_read_own ON public.users;
CREATE POLICY user_read_own ON public.users
    FOR SELECT
    TO authenticated
    USING (
        id = (
            CASE 
                WHEN current_setting('request.jwt.claim.sub', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN current_setting('request.jwt.claim.sub', true)::uuid
                ELSE NULL 
            END
        )
        OR auth_is_admin()
    );

-- Enforce patient-only, unverified registration at database level
DROP POLICY IF EXISTS user_insert_registration ON public.users;
CREATE POLICY user_insert_registration ON public.users
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        role = 'patient'
        AND is_active = true
        AND is_verified = false
        AND deleted_at IS NULL
    );

DROP POLICY IF EXISTS user_update_own ON public.users;
CREATE POLICY user_update_own ON public.users
    FOR UPDATE
    TO authenticated
    USING (
        id = (
            CASE 
                WHEN current_setting('request.jwt.claim.sub', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN current_setting('request.jwt.claim.sub', true)::uuid
                ELSE NULL 
            END
        )
    )
    WITH CHECK (
        id = (
            CASE 
                WHEN current_setting('request.jwt.claim.sub', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN current_setting('request.jwt.claim.sub', true)::uuid
                ELSE NULL 
            END
        )
        AND role = 'patient'
        AND is_active = true
        AND deleted_at IS NULL
    );

DROP POLICY IF EXISTS service_role_users_all ON public.users;
CREATE POLICY service_role_users_all ON public.users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 9. Policies for `user_profiles` Table
DROP POLICY IF EXISTS profile_read_own ON public.user_profiles;
CREATE POLICY profile_read_own ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (
        user_id = (
            CASE 
                WHEN current_setting('request.jwt.claim.sub', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN current_setting('request.jwt.claim.sub', true)::uuid
                ELSE NULL 
            END
        )
        OR auth_is_admin()
    );

DROP POLICY IF EXISTS profile_insert_own ON public.user_profiles;
CREATE POLICY profile_insert_own ON public.user_profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = (
            CASE 
                WHEN current_setting('request.jwt.claim.sub', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN current_setting('request.jwt.claim.sub', true)::uuid
                ELSE NULL 
            END
        )
    );

DROP POLICY IF EXISTS profile_update_own ON public.user_profiles;
CREATE POLICY profile_update_own ON public.user_profiles
    FOR UPDATE
    TO authenticated
    USING (
        user_id = (
            CASE 
                WHEN current_setting('request.jwt.claim.sub', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN current_setting('request.jwt.claim.sub', true)::uuid
                ELSE NULL 
            END
        )
    )
    WITH CHECK (
        user_id = (
            CASE 
                WHEN current_setting('request.jwt.claim.sub', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN current_setting('request.jwt.claim.sub', true)::uuid
                ELSE NULL 
            END
        )
    );

DROP POLICY IF EXISTS service_role_profiles_all ON public.user_profiles;
CREATE POLICY service_role_profiles_all ON public.user_profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 10. Policies for `assessments` Table
DROP POLICY IF EXISTS assessment_read_own ON public.assessments;
CREATE POLICY assessment_read_own ON public.assessments
    FOR SELECT
    TO authenticated
    USING (
        (
            user_id = (
                CASE 
                WHEN current_setting('request.jwt.claim.sub', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN current_setting('request.jwt.claim.sub', true)::uuid
                ELSE NULL 
            END
            )
            OR auth_is_admin()
        )
        AND deleted_at IS NULL
    );

DROP POLICY IF EXISTS assessment_insert_own ON public.assessments;
CREATE POLICY assessment_insert_own ON public.assessments
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = (
            CASE 
                WHEN current_setting('request.jwt.claim.sub', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN current_setting('request.jwt.claim.sub', true)::uuid
                ELSE NULL 
            END
        )
    );

DROP POLICY IF EXISTS assessment_update_own ON public.assessments;
CREATE POLICY assessment_update_own ON public.assessments
    FOR UPDATE
    TO authenticated
    USING (
        user_id = (
            CASE 
                WHEN current_setting('request.jwt.claim.sub', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN current_setting('request.jwt.claim.sub', true)::uuid
                ELSE NULL 
            END
        )
    )
    WITH CHECK (
        user_id = (
            CASE 
                WHEN current_setting('request.jwt.claim.sub', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN current_setting('request.jwt.claim.sub', true)::uuid
                ELSE NULL 
            END
        )
    );

DROP POLICY IF EXISTS service_role_assessments_all ON public.assessments;
CREATE POLICY service_role_assessments_all ON public.assessments
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 11. Policies for `assessment_reports` Table
DROP POLICY IF EXISTS reports_read_own ON public.assessment_reports;
CREATE POLICY reports_read_own ON public.assessment_reports
    FOR SELECT
    TO authenticated
    USING (
        user_id = (
            CASE 
                WHEN current_setting('request.jwt.claim.sub', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN current_setting('request.jwt.claim.sub', true)::uuid
                ELSE NULL 
            END
        )
        OR auth_is_admin()
    );

DROP POLICY IF EXISTS reports_insert_own ON public.assessment_reports;
CREATE POLICY reports_insert_own ON public.assessment_reports
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = (
            CASE 
                WHEN current_setting('request.jwt.claim.sub', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN current_setting('request.jwt.claim.sub', true)::uuid
                ELSE NULL 
            END
        )
    );

DROP POLICY IF EXISTS service_role_reports_all ON public.assessment_reports;
CREATE POLICY service_role_reports_all ON public.assessment_reports
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 12. Policies for `refresh_tokens` Table
DROP POLICY IF EXISTS refresh_tokens_own ON public.refresh_tokens;
CREATE POLICY refresh_tokens_own ON public.refresh_tokens
    FOR ALL
    TO authenticated
    USING (
        user_id = (
            CASE 
                WHEN current_setting('request.jwt.claim.sub', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN current_setting('request.jwt.claim.sub', true)::uuid
                ELSE NULL 
            END
        )
    );

DROP POLICY IF EXISTS service_role_tokens_all ON public.refresh_tokens;
CREATE POLICY service_role_tokens_all ON public.refresh_tokens
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 13. Policies for `audit_logs` Table
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS audit_logs_admin_only ON public.audit_logs;
CREATE POLICY audit_logs_admin_only ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (auth_is_admin());

DROP POLICY IF EXISTS service_role_audit_all ON public.audit_logs;
CREATE POLICY service_role_audit_all ON public.audit_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 14. GIN Acceleration Indexes
CREATE INDEX IF NOT EXISTS idx_assessments_gin_biomarkers ON public.assessments USING gin(input_biomarkers);
CREATE INDEX IF NOT EXISTS idx_assessments_gin_shap ON public.assessments USING gin(shap_summary);

-- 15. Record Script 2 Completion in Manifest
INSERT INTO public._healthsync_staging_manifest (phase, snapshot_key, data)
VALUES (
    'deployment_tracking',
    'script_2_applied',
    jsonb_build_object('applied_at', now(), 'status', 'complete')
);
