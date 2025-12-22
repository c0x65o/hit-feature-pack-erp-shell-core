-- Feature Pack: dashboard-shell
-- Minimal example dashboard definition (pack-scoped) so the pack ships something
-- without depending on app metrics or custom forms.

INSERT INTO "dashboard_definitions" (
  "key",
  "owner_user_id",
  "is_system",
  "name",
  "description",
  "visibility",
  "scope",
  "version",
  "definition",
  "updated_at"
)
VALUES (
  'system.dashboard_shell_example',
  'system',
  TRUE,
  'Dashboard (Example)',
  'A minimal example dashboard shipped by the dashboard-shell feature pack.',
  'public',
  '{"kind":"pack","pack":"dashboard-shell"}'::jsonb,
  0,
  $json$
  {
    "time": { "mode": "picker", "default": "last_30_days" },
    "layout": { "grid": { "cols": 12, "rowHeight": 36, "gap": 14 } },
    "widgets": []
  }
  $json$::jsonb,
  NOW()
)
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "scope" = EXCLUDED."scope",
  "version" = EXCLUDED."version",
  "definition" = EXCLUDED."definition",
  "updated_at" = EXCLUDED."updated_at";


