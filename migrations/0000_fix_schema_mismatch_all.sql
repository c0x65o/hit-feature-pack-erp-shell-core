-- Feature Pack: erp-shell-core
-- Purpose: Repair legacy schema placement where app tables were created under a schema
-- named after the database (e.g. hit_dashboard) instead of the per-project schema
-- (current_schema()).
--
-- This is a one-time convergence migration:
-- - If a table already exists in current_schema(), we leave it alone.
-- - If a table exists only in hit_dashboard schema, we move it into current_schema().
--
-- Why this exists:
-- - HIT uses search_path=<project_schema>,public for the app DB.
-- - If tables live in hit_dashboard schema, feature-pack SQL + runtime queries fail with
--   "relation does not exist" even though the table exists.

DO $$
DECLARE
  src_schema text := 'hit_dashboard';
  dst_schema text := current_schema();
  r record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = src_schema) THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = src_schema
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  LOOP
    IF to_regclass(format('%I.%I', dst_schema, r.table_name)) IS NOT NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE %I.%I SET SCHEMA %I;', src_schema, r.table_name, dst_schema);
  END LOOP;
END $$;

