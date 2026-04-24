-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RecurringFrequency') THEN
    CREATE TYPE "RecurringFrequency" AS ENUM ('MONTHLY', 'QUARTERLY');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VoucherStatus') THEN
    CREATE TYPE "VoucherStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApprovalStepStatus') THEN
    CREATE TYPE "ApprovalStepStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceStatus') THEN
    CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'CREDITED');
  END IF;
END $$;

-- AlterTable
ALTER TABLE "vouchers"
  ADD COLUMN IF NOT EXISTS "status" "VoucherStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "submitted_by_user_id" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "voucher_templates" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "is_recurring" BOOLEAN NOT NULL DEFAULT false,
  "frequency" "RecurringFrequency",
  "day_of_month" INTEGER,
  "next_run_date" TIMESTAMP(3),
  "last_run_date" TIMESTAMP(3),
  "recurring_end_date" TIMESTAMP(3),

  CONSTRAINT "voucher_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voucher_template_lines" (
  "id" TEXT NOT NULL,
  "template_id" TEXT NOT NULL,
  "account_number" TEXT NOT NULL,
  "debit" INTEGER NOT NULL DEFAULT 0,
  "credit" INTEGER NOT NULL DEFAULT 0,
  "description" TEXT,

  CONSTRAINT "voucher_template_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "budgets" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "fiscal_year_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "budget_entries" (
  "id" TEXT NOT NULL,
  "budget_id" TEXT NOT NULL,
  "account_number" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,

  CONSTRAINT "budget_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "approval_rules" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "min_amount" INTEGER NOT NULL,
  "max_amount" INTEGER,
  "required_role" "MemberRole" NOT NULL,
  "step_order" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "approval_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "approval_steps" (
  "id" TEXT NOT NULL,
  "voucher_id" TEXT NOT NULL,
  "step_order" INTEGER NOT NULL,
  "required_role" "MemberRole" NOT NULL,
  "approver_user_id" TEXT,
  "status" "ApprovalStepStatus" NOT NULL DEFAULT 'PENDING',
  "comment" TEXT,
  "decided_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "customers" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "customer_number" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "postal_code" TEXT,
  "city" TEXT,
  "country" TEXT DEFAULT 'SE',
  "org_number" TEXT,
  "vat_number" TEXT,
  "reference" TEXT,
  "payment_term_days" INTEGER NOT NULL DEFAULT 30,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "invoices" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "invoice_number" INTEGER NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "issue_date" TIMESTAMP(3) NOT NULL,
  "due_date" TIMESTAMP(3) NOT NULL,
  "paid_date" TIMESTAMP(3),
  "our_reference" TEXT,
  "your_reference" TEXT,
  "notes" TEXT,
  "subtotal" INTEGER NOT NULL DEFAULT 0,
  "vat_amount" INTEGER NOT NULL DEFAULT 0,
  "total_amount" INTEGER NOT NULL DEFAULT 0,
  "voucher_id" TEXT,
  "credited_invoice_id" TEXT,
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "invoice_lines" (
  "id" TEXT NOT NULL,
  "invoice_id" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 100,
  "unit_price" INTEGER NOT NULL,
  "vat_rate" INTEGER NOT NULL DEFAULT 2500,
  "amount" INTEGER NOT NULL DEFAULT 0,
  "account_number" TEXT,

  CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vouchers_organization_id_status_idx" ON "vouchers"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "voucher_templates_organization_id_name_key" ON "voucher_templates"("organization_id", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voucher_templates_organization_id_idx" ON "voucher_templates"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voucher_templates_is_recurring_next_run_date_idx" ON "voucher_templates"("is_recurring", "next_run_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voucher_template_lines_template_id_idx" ON "voucher_template_lines"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "budgets_organization_id_fiscal_year_id_name_key" ON "budgets"("organization_id", "fiscal_year_id", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "budgets_organization_id_idx" ON "budgets"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "budgets_fiscal_year_id_idx" ON "budgets"("fiscal_year_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "budget_entries_budget_id_account_number_month_key" ON "budget_entries"("budget_id", "account_number", "month");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "budget_entries_budget_id_idx" ON "budget_entries"("budget_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "approval_rules_organization_id_idx" ON "approval_rules"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "approval_steps_voucher_id_idx" ON "approval_steps"("voucher_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "approval_steps_approver_user_id_idx" ON "approval_steps"("approver_user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "approval_steps_status_idx" ON "approval_steps"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "customers_organization_id_customer_number_key" ON "customers"("organization_id", "customer_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "customers_organization_id_idx" ON "customers"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_voucher_id_key" ON "invoices"("voucher_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_organization_id_invoice_number_key" ON "invoices"("organization_id", "invoice_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_organization_id_idx" ON "invoices"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_customer_id_idx" ON "invoices"("customer_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_organization_id_status_idx" ON "invoices"("organization_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoice_lines_invoice_id_idx" ON "invoice_lines"("invoice_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'voucher_templates_organization_id_fkey') THEN
    ALTER TABLE "voucher_templates"
      ADD CONSTRAINT "voucher_templates_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'voucher_template_lines_template_id_fkey') THEN
    ALTER TABLE "voucher_template_lines"
      ADD CONSTRAINT "voucher_template_lines_template_id_fkey"
      FOREIGN KEY ("template_id") REFERENCES "voucher_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budgets_organization_id_fkey') THEN
    ALTER TABLE "budgets"
      ADD CONSTRAINT "budgets_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budgets_fiscal_year_id_fkey') THEN
    ALTER TABLE "budgets"
      ADD CONSTRAINT "budgets_fiscal_year_id_fkey"
      FOREIGN KEY ("fiscal_year_id") REFERENCES "fiscal_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budget_entries_budget_id_fkey') THEN
    ALTER TABLE "budget_entries"
      ADD CONSTRAINT "budget_entries_budget_id_fkey"
      FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_rules_organization_id_fkey') THEN
    ALTER TABLE "approval_rules"
      ADD CONSTRAINT "approval_rules_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_steps_voucher_id_fkey') THEN
    ALTER TABLE "approval_steps"
      ADD CONSTRAINT "approval_steps_voucher_id_fkey"
      FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_steps_approver_user_id_fkey') THEN
    ALTER TABLE "approval_steps"
      ADD CONSTRAINT "approval_steps_approver_user_id_fkey"
      FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_organization_id_fkey') THEN
    ALTER TABLE "customers"
      ADD CONSTRAINT "customers_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_organization_id_fkey') THEN
    ALTER TABLE "invoices"
      ADD CONSTRAINT "invoices_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_customer_id_fkey') THEN
    ALTER TABLE "invoices"
      ADD CONSTRAINT "invoices_customer_id_fkey"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_voucher_id_fkey') THEN
    ALTER TABLE "invoices"
      ADD CONSTRAINT "invoices_voucher_id_fkey"
      FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_credited_invoice_id_fkey') THEN
    ALTER TABLE "invoices"
      ADD CONSTRAINT "invoices_credited_invoice_id_fkey"
      FOREIGN KEY ("credited_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_lines_invoice_id_fkey') THEN
    ALTER TABLE "invoice_lines"
      ADD CONSTRAINT "invoice_lines_invoice_id_fkey"
      FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;