/**
 * Repository interfaces — core contracts that outer layers implement.
 *
 * Placing interfaces in the innermost package (@muninsbok/core) ensures that
 * the domain never depends on infrastructure (Dependency Inversion Principle).
 */

import type { Result } from "./result.js";
import type { Organization, CreateOrganizationInput, OrganizationError } from "./organization.js";
import type { FiscalYear, CreateFiscalYearInput, FiscalYearError } from "./fiscal-year.js";
import type { Account, CreateAccountInput, UpdateAccountInput, AccountError } from "./account.js";
import type { Voucher, CreateVoucherInput, VoucherError } from "./voucher.js";
import type {
  ApprovalRule,
  CreateApprovalRuleInput,
  UpdateApprovalRuleInput,
  ApprovalRuleError,
  ApprovalStep,
  ApprovalDecisionInput,
  ApprovalError,
} from "./approval.js";
import type { Document, CreateDocumentInput, DocumentError } from "./document.js";
import type {
  VoucherTemplate,
  CreateVoucherTemplateInput,
  UpdateVoucherTemplateInput,
  VoucherTemplateError,
} from "./voucher-template.js";
import type {
  ExecuteResultDispositionInput,
  ResultDispositionError,
} from "./result-disposition.js";
import type { Budget, CreateBudgetInput, UpdateBudgetInput, BudgetError } from "./budget.js";
import type {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerError,
} from "./customer.js";
import type { Invoice, CreateInvoiceInput, UpdateInvoiceInput, InvoiceError } from "./invoice.js";
import type {
  BankConnection,
  CreateBankConnectionInput,
  UpdateBankConnectionInput,
  UpdateBankConnectionStatusInput,
  BankConnectionError,
  BankTransaction,
  UpsertBankTransactionInput,
  BankTransactionMatchStatus,
  BankTransactionMatchUpdateInput,
  BankTransactionError,
  BankSyncRun,
  CreateBankSyncRunInput,
  CompleteBankSyncRunInput,
  BankWebhookEvent,
  CreateBankWebhookEventInput,
  UpdateBankWebhookEventInput,
  BankWebhookEventError,
} from "./bank.js";
import type {
  User,
  CreateUserInput,
  UserError,
  MemberRole,
  OrganizationMember,
  OrganizationMemberWithUser,
} from "./user.js";

// ── Pagination ──────────────────────────────────────────────

export interface PaginatedQuery {
  readonly page: number;
  readonly limit: number;
  readonly search?: string;
}

export interface PaginatedResult<T> {
  readonly data: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

// ── Organization ────────────────────────────────────────────

export interface IOrganizationRepository {
  findById(id: string): Promise<Organization | null>;
  findByOrgNumber(orgNumber: string): Promise<Organization | null>;
  findAll(): Promise<Organization[]>;
  findByUserMembership(userId: string): Promise<Organization[]>;
  create(input: CreateOrganizationInput): Promise<Result<Organization, OrganizationError>>;
  update(
    id: string,
    data: Partial<Pick<Organization, "name" | "fiscalYearStartMonth">>,
  ): Promise<Organization | null>;
  delete(id: string): Promise<boolean>;
}

// ── Account ─────────────────────────────────────────────────

export interface IAccountRepository {
  findByOrganization(organizationId: string): Promise<Account[]>;
  findActive(organizationId: string): Promise<Account[]>;
  findByNumber(organizationId: string, number: string): Promise<Account | null>;
  create(organizationId: string, input: CreateAccountInput): Promise<Result<Account, AccountError>>;
  createMany(organizationId: string, inputs: readonly CreateAccountInput[]): Promise<number>;
  deactivate(organizationId: string, number: string): Promise<boolean>;
  update(
    organizationId: string,
    number: string,
    input: UpdateAccountInput,
  ): Promise<Result<Account, AccountError>>;
}

// ── Voucher ─────────────────────────────────────────────────

export interface IVoucherRepository {
  findById(id: string, organizationId: string): Promise<Voucher | null>;
  findByFiscalYear(fiscalYearId: string, organizationId: string): Promise<Voucher[]>;
  findByFiscalYearPaginated(
    fiscalYearId: string,
    organizationId: string,
    options: PaginatedQuery,
  ): Promise<PaginatedResult<Voucher>>;
  findByDateRange(organizationId: string, startDate: Date, endDate: Date): Promise<Voucher[]>;
  create(input: CreateVoucherInput): Promise<Result<Voucher, VoucherError>>;
  createCorrection(
    voucherId: string,
    organizationId: string,
  ): Promise<Result<Voucher, VoucherError>>;
  getNextVoucherNumber(fiscalYearId: string): Promise<number>;
  findNumberGaps(fiscalYearId: string, organizationId: string): Promise<number[]>;
  /** Check if a voucher belongs to a closed fiscal year. */
  isVoucherInClosedFiscalYear(voucherId: string, organizationId: string): Promise<boolean>;
}

// ── FiscalYear ──────────────────────────────────────────────

export interface IFiscalYearRepository {
  findByOrganization(organizationId: string): Promise<FiscalYear[]>;
  findById(id: string, organizationId: string): Promise<FiscalYear | null>;
  /** Find the most recent fiscal year ending before `beforeDate`. */
  findPreviousByDate(organizationId: string, beforeDate: Date): Promise<FiscalYear | null>;
  create(input: CreateFiscalYearInput): Promise<Result<FiscalYear, FiscalYearError>>;
  close(id: string, organizationId: string): Promise<Result<FiscalYear, FiscalYearError>>;
  createOpeningBalances(
    fiscalYearId: string,
    previousFiscalYearId: string,
    organizationId: string,
  ): Promise<Result<Voucher, FiscalYearError>>;
  /** Execute result disposition: transfer 2099 → 2091 in the target fiscal year. */
  executeResultDisposition(
    input: ExecuteResultDispositionInput,
  ): Promise<Result<Voucher, ResultDispositionError>>;
}

// ── Voucher Template ────────────────────────────────────────

export interface IVoucherTemplateRepository {
  findByOrganization(organizationId: string): Promise<VoucherTemplate[]>;
  findById(id: string, organizationId: string): Promise<VoucherTemplate | null>;
  /** Find recurring templates due for execution (nextRunDate <= asOf). */
  findDueRecurring(organizationId: string, asOf: Date): Promise<VoucherTemplate[]>;
  create(
    organizationId: string,
    input: CreateVoucherTemplateInput,
  ): Promise<Result<VoucherTemplate, VoucherTemplateError>>;
  update(
    id: string,
    organizationId: string,
    input: UpdateVoucherTemplateInput,
  ): Promise<Result<VoucherTemplate, VoucherTemplateError>>;
  updateRecurringSchedule(
    id: string,
    organizationId: string,
    schedule: {
      isRecurring: boolean;
      frequency?: "MONTHLY" | "QUARTERLY";
      dayOfMonth?: number;
      nextRunDate?: Date;
      recurringEndDate?: Date | null;
    },
  ): Promise<VoucherTemplate | null>;
  markRecurringRun(id: string, nextRunDate: Date): Promise<void>;
  delete(id: string, organizationId: string): Promise<boolean>;
}

// ── Document ────────────────────────────────────────────────

export interface IDocumentRepository {
  findById(id: string, organizationId: string): Promise<Document | null>;
  findByVoucher(voucherId: string, organizationId: string): Promise<Document[]>;
  findByOrganization(organizationId: string): Promise<Document[]>;
  create(input: CreateDocumentInput): Promise<Result<Document, DocumentError>>;
  delete(id: string, organizationId: string): Promise<boolean>;
}

// ── Document Storage ────────────────────────────────────────

export interface IDocumentStorage {
  generateStorageKey(organizationId: string, filename: string): string;
  store(storageKey: string, data: Uint8Array): Promise<void>;
  read(storageKey: string): Promise<Uint8Array>;
  remove(storageKey: string): Promise<boolean>;
}

// ── User ────────────────────────────────────────────────────

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<Result<User, UserError>>;
  /** Record a failed login attempt and optionally lock the account. */
  recordFailedLogin(userId: string, maxAttempts: number, lockoutMinutes: number): Promise<void>;
  /** Reset failed login counter on successful login. */
  resetFailedLogins(userId: string): Promise<void>;
  /** Update the stored password hash (e.g. for rehashing on login). */
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
  /** Members of an organization, including user details. */
  findMembersByOrganization(organizationId: string): Promise<OrganizationMemberWithUser[]>;
  /** Get a specific membership. */
  findMembership(userId: string, organizationId: string): Promise<OrganizationMember | null>;
  /** Add a user to an organization with a given role. */
  addMember(userId: string, organizationId: string, role: MemberRole): Promise<OrganizationMember>;
  /** Atomically update a member's role. */
  updateMemberRole(
    userId: string,
    organizationId: string,
    role: MemberRole,
  ): Promise<OrganizationMember | null>;
  /** Remove a user from an organization. */
  removeMember(userId: string, organizationId: string): Promise<boolean>;
  /** Get all organizations a user is a member of (returns SafeUser-scoped data). */
  findOrganizationsByUser(userId: string): Promise<OrganizationMember[]>;
}

// ── Refresh Token ───────────────────────────────────────────

export interface IRefreshTokenRepository {
  /** Store a new refresh token (jti = unique token identifier). */
  create(userId: string, jti: string, expiresAt: Date): Promise<void>;
  /** Check if a refresh token jti exists (not revoked). */
  existsByJti(jti: string): Promise<boolean>;
  /** Revoke a single refresh token by jti. */
  revokeByJti(jti: string): Promise<void>;
  /** Atomically revoke a refresh token by jti if it exists. Returns true if it was deleted. */
  revokeByJtiIfExists(jti: string): Promise<boolean>;
  /** Revoke all refresh tokens for a user (e.g. on logout / password change). */
  revokeAllByUserId(userId: string): Promise<void>;
  /** Delete expired tokens (housekeeping). */
  cleanupExpired(): Promise<number>;
}

// ── Approval Rule ───────────────────────────────────────────

export interface IApprovalRuleRepository {
  findByOrganization(organizationId: string): Promise<ApprovalRule[]>;
  findById(id: string, organizationId: string): Promise<ApprovalRule | null>;
  /** Find rules whose amount range matches the given voucher total. */
  findMatchingRules(organizationId: string, totalAmount: number): Promise<ApprovalRule[]>;
  create(
    organizationId: string,
    input: CreateApprovalRuleInput,
  ): Promise<Result<ApprovalRule, ApprovalRuleError>>;
  update(
    id: string,
    organizationId: string,
    input: UpdateApprovalRuleInput,
  ): Promise<Result<ApprovalRule, ApprovalRuleError>>;
  delete(id: string, organizationId: string): Promise<boolean>;
}

// ── Approval Step ───────────────────────────────────────────

export interface IApprovalStepRepository {
  findByVoucher(voucherId: string): Promise<ApprovalStep[]>;
  findById(id: string): Promise<ApprovalStep | null>;
  /** Find pending steps assigned to (or available for) a user's role. */
  findPendingByOrganization(organizationId: string): Promise<ApprovalStep[]>;
  createMany(
    voucherId: string,
    steps: readonly { stepOrder: number; requiredRole: string }[],
  ): Promise<ApprovalStep[]>;
  /** Record an approval / rejection decision. */
  decide(input: ApprovalDecisionInput): Promise<Result<ApprovalStep, ApprovalError>>;
}

// ── Budget ──────────────────────────────────────────────────

export interface IBudgetRepository {
  findByOrganization(organizationId: string): Promise<Budget[]>;
  findByFiscalYear(organizationId: string, fiscalYearId: string): Promise<Budget[]>;
  findById(id: string, organizationId: string): Promise<Budget | null>;
  create(organizationId: string, input: CreateBudgetInput): Promise<Result<Budget, BudgetError>>;
  update(
    id: string,
    organizationId: string,
    input: UpdateBudgetInput,
  ): Promise<Result<Budget, BudgetError>>;
  delete(id: string, organizationId: string): Promise<boolean>;
}

// ── Customer ────────────────────────────────────────────────

export interface ICustomerRepository {
  findByOrganization(organizationId: string): Promise<Customer[]>;
  findById(id: string, organizationId: string): Promise<Customer | null>;
  getNextCustomerNumber(organizationId: string): Promise<number>;
  create(
    organizationId: string,
    input: CreateCustomerInput,
  ): Promise<Result<Customer, CustomerError>>;
  update(
    id: string,
    organizationId: string,
    input: UpdateCustomerInput,
  ): Promise<Result<Customer, CustomerError>>;
  delete(id: string, organizationId: string): Promise<boolean>;
}

// ── Invoice ─────────────────────────────────────────────────

export interface IInvoiceRepository {
  findByOrganization(organizationId: string): Promise<Invoice[]>;
  findById(id: string, organizationId: string): Promise<Invoice | null>;
  findByCustomer(customerId: string, organizationId: string): Promise<Invoice[]>;
  findByStatus(organizationId: string, status: string): Promise<Invoice[]>;
  getNextInvoiceNumber(organizationId: string): Promise<number>;
  create(organizationId: string, input: CreateInvoiceInput): Promise<Result<Invoice, InvoiceError>>;
  update(
    id: string,
    organizationId: string,
    input: UpdateInvoiceInput,
  ): Promise<Result<Invoice, InvoiceError>>;
  updateStatus(
    id: string,
    organizationId: string,
    status: string,
    extra?: { paidDate?: Date; sentAt?: Date; voucherId?: string },
  ): Promise<Result<Invoice, InvoiceError>>;
  delete(id: string, organizationId: string): Promise<boolean>;
}

// ── Bank Connection ────────────────────────────────────────

export interface IBankConnectionRepository {
  findByOrganization(organizationId: string): Promise<BankConnection[]>;
  findById(id: string, organizationId: string): Promise<BankConnection | null>;
  findByExternalConnectionId(
    organizationId: string,
    provider: string,
    externalConnectionId: string,
  ): Promise<BankConnection | null>;
  create(
    organizationId: string,
    input: CreateBankConnectionInput,
  ): Promise<Result<BankConnection, BankConnectionError>>;
  update(
    id: string,
    organizationId: string,
    input: UpdateBankConnectionInput,
  ): Promise<Result<BankConnection, BankConnectionError>>;
  updateStatus(
    id: string,
    organizationId: string,
    input: UpdateBankConnectionStatusInput,
  ): Promise<BankConnection | null>;
  delete(id: string, organizationId: string): Promise<boolean>;
}

// ── Bank Transaction ───────────────────────────────────────

export interface IBankTransactionRepository {
  findById(id: string, organizationId: string): Promise<BankTransaction | null>;
  findByConnectionPaginated(
    connectionId: string,
    organizationId: string,
    options: PaginatedQuery & {
      fromDate?: Date;
      toDate?: Date;
      matchStatus?: BankTransactionMatchStatus;
    },
  ): Promise<PaginatedResult<BankTransaction>>;
  findUnmatchedByOrganization(organizationId: string, limit: number): Promise<BankTransaction[]>;
  upsertMany(
    organizationId: string,
    connectionId: string,
    transactions: readonly UpsertBankTransactionInput[],
  ): Promise<Result<{ created: number; updated: number }, BankTransactionError>>;
  updateMatch(
    id: string,
    organizationId: string,
    input: BankTransactionMatchUpdateInput,
  ): Promise<BankTransaction | null>;
  updateMatchMany(
    ids: string[],
    organizationId: string,
    input: BankTransactionMatchUpdateInput,
  ): Promise<number>;
  deleteByConnection(connectionId: string, organizationId: string): Promise<number>;
}

// ── Bank Sync Run ──────────────────────────────────────────

export interface IBankSyncRunRepository {
  findById(id: string, organizationId: string): Promise<BankSyncRun | null>;
  findLatestByConnection(
    connectionId: string,
    organizationId: string,
    limit: number,
  ): Promise<BankSyncRun[]>;
  create(
    organizationId: string,
    connectionId: string,
    input: CreateBankSyncRunInput,
  ): Promise<BankSyncRun>;
  markRunning(id: string, organizationId: string): Promise<BankSyncRun | null>;
  complete(
    id: string,
    organizationId: string,
    input: CompleteBankSyncRunInput,
  ): Promise<BankSyncRun | null>;
}

// ── Bank Webhook Event ─────────────────────────────────────

export interface IBankWebhookEventRepository {
  findById(id: string, organizationId: string): Promise<BankWebhookEvent | null>;
  findByProviderEventId(
    organizationId: string,
    provider: string,
    providerEventId: string,
  ): Promise<BankWebhookEvent | null>;
  listRecentByOrganization(organizationId: string, limit: number): Promise<BankWebhookEvent[]>;
  create(
    input: CreateBankWebhookEventInput,
  ): Promise<Result<BankWebhookEvent, BankWebhookEventError>>;
  update(
    id: string,
    organizationId: string,
    input: UpdateBankWebhookEventInput,
  ): Promise<BankWebhookEvent | null>;
}
