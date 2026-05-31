-- CreateTable
CREATE TABLE IF NOT EXISTS "accounting_events" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "user_id" TEXT,
  "request_id" TEXT,
  "payload_summary" TEXT,
  "payload_hash" TEXT,
  "correction_event_id" TEXT,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "accounting_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "accounting_events_organization_id_occurred_at_idx"
  ON "accounting_events"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "accounting_events_resource_type_resource_id_idx"
  ON "accounting_events"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "accounting_events_event_type_idx"
  ON "accounting_events"("event_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "accounting_events_correction_event_id_idx"
  ON "accounting_events"("correction_event_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounting_events_organization_id_fkey') THEN
    ALTER TABLE "accounting_events"
      ADD CONSTRAINT "accounting_events_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
