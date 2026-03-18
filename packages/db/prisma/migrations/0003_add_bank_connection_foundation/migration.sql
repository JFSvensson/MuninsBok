-- CreateEnum
CREATE TYPE "BankConnectionStatus" AS ENUM ('CONNECTED', 'AUTH_REQUIRED', 'SYNCING', 'FAILED');

-- CreateEnum
CREATE TYPE "BankTransactionMatchStatus" AS ENUM ('PENDING_MATCH', 'MATCHED', 'CONFIRMED', 'ERROR');

-- CreateEnum
CREATE TYPE "BankSyncRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "BankSyncTrigger" AS ENUM ('MANUAL', 'SCHEDULED', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "BankWebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateTable
CREATE TABLE "bank_connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "external_connection_id" TEXT NOT NULL,
    "display_name" TEXT,
    "account_name" TEXT,
    "account_iban" TEXT,
    "account_last4" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'SEK',
    "status" "BankConnectionStatus" NOT NULL DEFAULT 'AUTH_REQUIRED',
    "auth_expires_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "last_error_code" TEXT,
    "last_error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "provider_transaction_id" TEXT NOT NULL,
    "booked_at" TIMESTAMP(3) NOT NULL,
    "value_date" TIMESTAMP(3),
    "description" TEXT NOT NULL,
    "amount_ore" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SEK',
    "reference" TEXT,
    "counterparty_name" TEXT,
    "match_status" "BankTransactionMatchStatus" NOT NULL DEFAULT 'PENDING_MATCH',
    "matched_voucher_id" TEXT,
    "match_confidence" INTEGER,
    "match_note" TEXT,
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_sync_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "trigger" "BankSyncTrigger" NOT NULL,
    "status" "BankSyncRunStatus" NOT NULL DEFAULT 'PENDING',
    "external_run_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_webhook_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "connection_id" TEXT,
    "provider" TEXT NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "status" "BankWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "signature_validated" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_connections_organization_id_provider_external_connection_id_key" ON "bank_connections"("organization_id", "provider", "external_connection_id");

-- CreateIndex
CREATE INDEX "bank_connections_organization_id_status_idx" ON "bank_connections"("organization_id", "status");

-- CreateIndex
CREATE INDEX "bank_connections_organization_id_last_synced_at_idx" ON "bank_connections"("organization_id", "last_synced_at");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_connection_id_provider_transaction_id_key" ON "bank_transactions"("connection_id", "provider_transaction_id");

-- CreateIndex
CREATE INDEX "bank_transactions_organization_id_booked_at_idx" ON "bank_transactions"("organization_id", "booked_at");

-- CreateIndex
CREATE INDEX "bank_transactions_organization_id_match_status_idx" ON "bank_transactions"("organization_id", "match_status");

-- CreateIndex
CREATE INDEX "bank_transactions_matched_voucher_id_idx" ON "bank_transactions"("matched_voucher_id");

-- CreateIndex
CREATE INDEX "bank_sync_runs_organization_id_status_idx" ON "bank_sync_runs"("organization_id", "status");

-- CreateIndex
CREATE INDEX "bank_sync_runs_organization_id_started_at_idx" ON "bank_sync_runs"("organization_id", "started_at");

-- CreateIndex
CREATE INDEX "bank_sync_runs_connection_id_started_at_idx" ON "bank_sync_runs"("connection_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "bank_webhook_events_organization_id_provider_provider_event_id_key" ON "bank_webhook_events"("organization_id", "provider", "provider_event_id");

-- CreateIndex
CREATE INDEX "bank_webhook_events_organization_id_status_idx" ON "bank_webhook_events"("organization_id", "status");

-- CreateIndex
CREATE INDEX "bank_webhook_events_received_at_idx" ON "bank_webhook_events"("received_at");

-- CreateIndex
CREATE INDEX "bank_webhook_events_connection_id_idx" ON "bank_webhook_events"("connection_id");

-- AddForeignKey
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "bank_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matched_voucher_id_fkey" FOREIGN KEY ("matched_voucher_id") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_sync_runs" ADD CONSTRAINT "bank_sync_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_sync_runs" ADD CONSTRAINT "bank_sync_runs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "bank_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_webhook_events" ADD CONSTRAINT "bank_webhook_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_webhook_events" ADD CONSTRAINT "bank_webhook_events_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "bank_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
