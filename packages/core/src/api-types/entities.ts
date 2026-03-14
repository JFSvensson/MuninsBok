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
