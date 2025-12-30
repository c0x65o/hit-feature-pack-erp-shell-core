-- Add server-backed notification read state

CREATE TABLE IF NOT EXISTS "notification_reads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar(255) NOT NULL,
  "notification_id" text NOT NULL,
  "read_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "notification_reads_user_id_idx"
  ON "notification_reads" ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "notification_reads_user_notification_unique"
  ON "notification_reads" ("user_id", "notification_id");

CREATE INDEX IF NOT EXISTS "notification_reads_read_at_idx"
  ON "notification_reads" ("read_at");

