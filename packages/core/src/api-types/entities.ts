/**
 * API contract types for entity resources.
 *
 * These represent the JSON shapes returned by the API — dates are ISO 8601
 * strings and amounts follow the unit documented per field.
 */

export interface Organization {
  id: string;
  orgNumber: string;
  name: string;
  fiscalYearStartMonth: number;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalYear {
  id: string;
  organizationId: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  number: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  isVatAccount: boolean;
  isActive: boolean;
}

export interface VoucherLine {
  id: string;
  voucherId: string;
  accountNumber: string;
  /** Amount in öre (cents) */
  debit: number;
  /** Amount in öre (cents) */
  credit: number;
  description?: string;
}

export interface Voucher {
  id: string;
  fiscalYearId: string;
  organizationId: string;
  number: number;
  date: string;
  description: string;
  lines: VoucherLine[];
  documentIds: string[];
  createdBy?: string;
  correctsVoucherId?: string;
  correctedByVoucherId?: string;
  status: VoucherStatus;
  submittedAt?: string;
  submittedByUserId?: string;
  approvalSteps?: ApprovalStepEntity[];
  createdAt: string;
  updatedAt: string;
}

export type VoucherStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

export type ApprovalStepStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ApprovalStepEntity {
  id: string;
  voucherId: string;
  stepOrder: number;
  requiredRole: MemberRole;
  approverUserId?: string;
  status: ApprovalStepStatus;
  comment?: string;
  decidedAt?: string;
  createdAt: string;
}

export interface ApprovalRuleEntity {
  id: string;
  organizationId: string;
  name: string;
  /** Min amount in öre */
  minAmount: number;
  /** Max amount in öre, null = no upper limit */
  maxAmount: number | null;
  requiredRole: MemberRole;
  stepOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentMeta {
  id: string;
  organizationId: string;
  voucherId?: string;
  filename: string;
  mimeType: string;
  storageKey: string;
  size: number;
  createdAt: string;
}

export interface ReceiptOcrPrefillLine {
  accountNumber?: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface ReceiptOcrAnalysis {
  sourceFilename: string;
  mimeType: string;
  extractedText: string;
  confidence: number;
  merchantName?: string;
  transactionDate?: string;
  totalAmountOre?: number;
  vatAmountOre?: number;
  currency?: string;
  suggestedDescription: string;
  prefillLines: ReceiptOcrPrefillLine[];
  warnings: string[];
}

export interface ReceiptOcrStatus {
  pdfEnabled: boolean;
  supportedMimeTypes: string[];
}

// ── Bank Connection ────────────────────────────────────────

export type BankConnectionStatus = "CONNECTED" | "AUTH_REQUIRED" | "SYNCING" | "FAILED";

export type BankTransactionMatchStatus = "PENDING_MATCH" | "MATCHED" | "CONFIRMED" | "ERROR";

export type BankSyncRunStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

export type BankSyncTrigger = "MANUAL" | "SCHEDULED" | "WEBHOOK";

export type BankWebhookEventStatus = "RECEIVED" | "PROCESSED" | "IGNORED" | "FAILED";

export interface BankConnectionEntity {
  id: string;
  organizationId: string;
  provider: string;
  externalConnectionId: string;
  displayName?: string;
  accountName?: string;
  accountIban?: string;
  accountLast4?: string;
  currency: string;
  status: BankConnectionStatus;
  authExpiresAt?: string;
  lastSyncedAt?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface BankTransactionEntity {
  id: string;
  organizationId: string;
  connectionId: string;
  providerTransactionId: string;
  bookedAt: string;
  valueDate?: string;
  description: string;
  /** Amount in öre (signed) */
  amountOre: number;
  currency: string;
  reference?: string;
  counterpartyName?: string;
  matchStatus: BankTransactionMatchStatus;
  matchedVoucherId?: string;
  matchConfidence?: number;
  matchNote?: string;
  rawData?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface BankSyncRunEntity {
  id: string;
  organizationId: string;
  connectionId: string;
  trigger: BankSyncTrigger;
  status: BankSyncRunStatus;
  externalRunId?: string;
  startedAt: string;
  completedAt?: string;
  importedCount: number;
  updatedCount: number;
  failedCount: number;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankWebhookEventEntity {
  id: string;
  organizationId: string;
  connectionId?: string;
  provider: string;
  providerEventId: string;
  eventType: string;
  status: BankWebhookEventStatus;
  signatureValidated: boolean;
  payload: unknown;
  receivedAt: string;
  processedAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export type MemberRole = "OWNER" | "ADMIN" | "MEMBER";

export interface OrgMember {
  id: string;
  userId: string;
  organizationId: string;
  role: MemberRole;
  createdAt: string;
}

export interface OrgMemberWithUser extends OrgMember {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

// ── Voucher Templates ───────────────────────────────────────

export interface VoucherTemplateLine {
  id: string;
  templateId: string;
  accountNumber: string;
  /** Amount in öre (cents) */
  debit: number;
  /** Amount in öre (cents) */
  credit: number;
  description?: string;
}

export type RecurringFrequency = "MONTHLY" | "QUARTERLY";

export interface VoucherTemplate {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  lines: VoucherTemplateLine[];
  isRecurring: boolean;
  frequency?: RecurringFrequency;
  dayOfMonth?: number;
  nextRunDate?: string;
  lastRunDate?: string;
  recurringEndDate?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Budgets ─────────────────────────────────────────────────

export interface BudgetEntry {
  id: string;
  budgetId: string;
  accountNumber: string;
  /** Month within fiscal year (1–12). */
  month: number;
  /** Budgeted amount in öre. Positive = debit, negative = credit. */
  amount: number;
}

export interface Budget {
  id: string;
  organizationId: string;
  fiscalYearId: string;
  name: string;
  entries: BudgetEntry[];
  createdAt: string;
  updatedAt: string;
}

// ── Customer ────────────────────────────────────────────────

export interface CustomerEntity {
  id: string;
  organizationId: string;
  customerNumber: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  orgNumber?: string;
  vatNumber?: string;
  reference?: string;
  paymentTermDays: number;
  createdAt: string;
  updatedAt: string;
}

// ── Invoice ─────────────────────────────────────────────────

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED" | "CREDITED";

export interface InvoiceLineEntity {
  id: string;
  invoiceId: string;
  description: string;
  /** Quantity × 100 (e.g. 100 = 1.00) */
  quantity: number;
  /** Unit price in öre */
  unitPrice: number;
  /** VAT rate × 100 (e.g. 2500 = 25%) */
  vatRate: number;
  /** Line amount excl. VAT in öre */
  amount: number;
  accountNumber?: string;
}

export interface InvoiceEntity {
  id: string;
  organizationId: string;
  customerId: string;
  invoiceNumber: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  ourReference?: string;
  yourReference?: string;
  notes?: string;
  /** Subtotal excl. VAT in öre */
  subtotal: number;
  /** VAT in öre */
  vatAmount: number;
  /** Total incl. VAT in öre */
  totalAmount: number;
  voucherId?: string;
  creditedInvoiceId?: string;
  sentAt?: string;
  lines: InvoiceLineEntity[];
  createdAt: string;
  updatedAt: string;
}
