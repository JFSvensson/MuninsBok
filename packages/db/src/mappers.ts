import type { Prisma } from "./generated/prisma/client.js";
import type {
  Organization as CoreOrganization,
  FiscalYear as CoreFiscalYear,
  Account as CoreAccount,
  Voucher as CoreVoucher,
  VoucherLine as CoreVoucherLine,
  VoucherTemplate as CoreVoucherTemplate,
  VoucherTemplateLine as CoreVoucherTemplateLine,
  Budget as CoreBudget,
  BudgetEntry as CoreBudgetEntry,
  Document as CoreDocument,
  AccountType,
  User as CoreUser,
  SafeUser as CoreSafeUser,
  MemberRole as CoreMemberRole,
  OrganizationMember as CoreOrganizationMember,
  OrganizationMemberWithUser as CoreOrganizationMemberWithUser,
  ApprovalRule as CoreApprovalRule,
  ApprovalStep as CoreApprovalStep,
  VoucherStatus as CoreVoucherStatus,
  ApprovalStepStatus as CoreApprovalStepStatus,
  Customer as CoreCustomer,
  Invoice as CoreInvoice,
  InvoiceLine as CoreInvoiceLine,
  InvoiceStatus as CoreInvoiceStatus,
  BankConnection as CoreBankConnection,
  BankConnectionStatus as CoreBankConnectionStatus,
  BankTransaction as CoreBankTransaction,
  BankTransactionMatchStatus as CoreBankTransactionMatchStatus,
  BankSyncRun as CoreBankSyncRun,
  BankSyncRunStatus as CoreBankSyncRunStatus,
  BankSyncTrigger as CoreBankSyncTrigger,
  BankWebhookEvent as CoreBankWebhookEvent,
  BankWebhookEventStatus as CoreBankWebhookEventStatus,
} from "@muninsbok/core/types";

/**
 * Map Prisma Organization to Core Organization
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
export function toOrganization(org: Prisma.OrganizationGetPayload<{}>): CoreOrganization {
  return {
    id: org.id,
    orgNumber: org.orgNumber,
    name: org.name,
    fiscalYearStartMonth: org.fiscalYearStartMonth,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
}

/**
 * Map Prisma FiscalYear to Core FiscalYear
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
export function toFiscalYear(fy: Prisma.FiscalYearGetPayload<{}>): CoreFiscalYear {
  return {
    id: fy.id,
    organizationId: fy.organizationId,
    startDate: fy.startDate,
    endDate: fy.endDate,
    isClosed: fy.isClosed,
    createdAt: fy.createdAt,
    updatedAt: fy.updatedAt,
  };
}

/**
 * Map Prisma Account to Core Account
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
export function toAccount(account: Prisma.AccountGetPayload<{}>): CoreAccount {
  return {
    number: account.number,
    name: account.name,
    type: account.type as AccountType,
    isVatAccount: account.isVatAccount,
    isActive: account.isActive,
  };
}

/**
 * Map Prisma Voucher with lines to Core Voucher
 */
export function toVoucher(
  voucher: Prisma.VoucherGetPayload<{
    include: { lines: true; documents: true; correctedByVoucher: true; approvalSteps: true };
  }>,
): CoreVoucher {
  return {
    id: voucher.id,
    fiscalYearId: voucher.fiscalYearId,
    organizationId: voucher.organizationId,
    number: voucher.number,
    date: voucher.date,
    description: voucher.description,
    lines: voucher.lines.map(toVoucherLine),
    documentIds: voucher.documents.map((d) => d.id),
    ...(voucher.createdBy != null && { createdBy: voucher.createdBy }),
    ...(voucher.correctsVoucherId != null && { correctsVoucherId: voucher.correctsVoucherId }),
    ...(voucher.correctedByVoucher != null && {
      correctedByVoucherId: voucher.correctedByVoucher.id,
    }),
    status: voucher.status as CoreVoucherStatus,
    ...(voucher.submittedAt != null && { submittedAt: voucher.submittedAt }),
    ...(voucher.submittedByUserId != null && { submittedByUserId: voucher.submittedByUserId }),
    ...(voucher.approvalSteps.length > 0 && {
      approvalSteps: voucher.approvalSteps.map(toApprovalStep),
    }),
    createdAt: voucher.createdAt,
    updatedAt: voucher.updatedAt,
  };
}

/**
 * Map Prisma VoucherLine to Core VoucherLine
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
export function toVoucherLine(line: Prisma.VoucherLineGetPayload<{}>): CoreVoucherLine {
  return {
    id: line.id,
    voucherId: line.voucherId,
    accountNumber: line.accountNumber,
    debit: line.debit,
    credit: line.credit,
    ...(line.description != null && { description: line.description }),
  };
}

/**
 * Map Prisma Document to Core Document
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
export function toDocument(doc: Prisma.DocumentGetPayload<{}>): CoreDocument {
  return {
    id: doc.id,
    organizationId: doc.organizationId,
    ...(doc.voucherId != null && { voucherId: doc.voucherId }),
    filename: doc.filename,
    mimeType: doc.mimeType,
    storageKey: doc.storageKey,
    size: doc.size,
    createdAt: doc.createdAt,
  };
}

/**
 * Map Prisma User to Core User
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
export function toUser(user: Prisma.UserGetPayload<{}>): CoreUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    passwordHash: user.passwordHash,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    failedLoginAttempts: user.failedLoginAttempts,
    lockedUntil: user.lockedUntil,
  };
}

/**
 * Map Prisma User to Core SafeUser (no passwordHash)
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
export function toSafeUser(user: Prisma.UserGetPayload<{}>): CoreSafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Map Prisma OrganizationMember to Core OrganizationMember
 */
export function toOrganizationMember(
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
  member: Prisma.OrganizationMemberGetPayload<{}>,
): CoreOrganizationMember {
  return {
    id: member.id,
    userId: member.userId,
    organizationId: member.organizationId,
    role: member.role as CoreMemberRole,
    createdAt: member.createdAt,
  };
}

/**
 * Map Prisma OrganizationMember (with user) to Core OrganizationMemberWithUser
 */
export function toOrganizationMemberWithUser(
  member: Prisma.OrganizationMemberGetPayload<{ include: { user: true } }>,
): CoreOrganizationMemberWithUser {
  return {
    id: member.id,
    userId: member.userId,
    organizationId: member.organizationId,
    role: member.role as CoreMemberRole,
    createdAt: member.createdAt,
    user: toSafeUser(member.user),
  };
}

/**
 * Map Prisma VoucherTemplateLine to Core VoucherTemplateLine
 */
export function toVoucherTemplateLine(
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
  line: Prisma.VoucherTemplateLineGetPayload<{}>,
): CoreVoucherTemplateLine {
  return {
    id: line.id,
    templateId: line.templateId,
    accountNumber: line.accountNumber,
    debit: line.debit,
    credit: line.credit,
    ...(line.description != null && { description: line.description }),
  };
}

/**
 * Map Prisma VoucherTemplate (with lines) to Core VoucherTemplate
 */
export function toVoucherTemplate(
  template: Prisma.VoucherTemplateGetPayload<{ include: { lines: true } }>,
): CoreVoucherTemplate {
  return {
    id: template.id,
    organizationId: template.organizationId,
    name: template.name,
    ...(template.description != null && { description: template.description }),
    lines: template.lines.map(toVoucherTemplateLine),
    isRecurring: template.isRecurring,
    ...(template.frequency != null && { frequency: template.frequency }),
    ...(template.dayOfMonth != null && { dayOfMonth: template.dayOfMonth }),
    ...(template.nextRunDate != null && { nextRunDate: template.nextRunDate }),
    ...(template.lastRunDate != null && { lastRunDate: template.lastRunDate }),
    ...(template.recurringEndDate != null && { recurringEndDate: template.recurringEndDate }),
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

/**
 * Map Prisma BudgetEntry to Core BudgetEntry
 */
export function toBudgetEntry(entry: Prisma.BudgetEntryGetPayload<object>): CoreBudgetEntry {
  return {
    id: entry.id,
    budgetId: entry.budgetId,
    accountNumber: entry.accountNumber,
    month: entry.month,
    amount: entry.amount,
  };
}

/**
 * Map Prisma Budget (with entries) to Core Budget
 */
export function toBudget(
  budget: Prisma.BudgetGetPayload<{ include: { entries: true } }>,
): CoreBudget {
  return {
    id: budget.id,
    organizationId: budget.organizationId,
    fiscalYearId: budget.fiscalYearId,
    name: budget.name,
    entries: budget.entries.map(toBudgetEntry),
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
  };
}

/**
 * Map Prisma ApprovalRule to Core ApprovalRule
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
export function toApprovalRule(rule: Prisma.ApprovalRuleGetPayload<{}>): CoreApprovalRule {
  return {
    id: rule.id,
    organizationId: rule.organizationId,
    name: rule.name,
    minAmount: rule.minAmount,
    maxAmount: rule.maxAmount,
    requiredRole: rule.requiredRole as CoreMemberRole,
    stepOrder: rule.stepOrder,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

/**
 * Map Prisma ApprovalStep to Core ApprovalStep
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
export function toApprovalStep(step: Prisma.ApprovalStepGetPayload<{}>): CoreApprovalStep {
  return {
    id: step.id,
    voucherId: step.voucherId,
    stepOrder: step.stepOrder,
    requiredRole: step.requiredRole as CoreMemberRole,
    approverUserId: step.approverUserId,
    status: step.status as CoreApprovalStepStatus,
    comment: step.comment,
    decidedAt: step.decidedAt,
    createdAt: step.createdAt,
  };
}

/**
 * Map Prisma Customer to Core Customer
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
export function toCustomer(customer: Prisma.CustomerGetPayload<{}>): CoreCustomer {
  return {
    id: customer.id,
    organizationId: customer.organizationId,
    customerNumber: customer.customerNumber,
    name: customer.name,
    ...(customer.email != null && { email: customer.email }),
    ...(customer.phone != null && { phone: customer.phone }),
    ...(customer.address != null && { address: customer.address }),
    ...(customer.postalCode != null && { postalCode: customer.postalCode }),
    ...(customer.city != null && { city: customer.city }),
    ...(customer.country != null && { country: customer.country }),
    ...(customer.orgNumber != null && { orgNumber: customer.orgNumber }),
    ...(customer.vatNumber != null && { vatNumber: customer.vatNumber }),
    ...(customer.reference != null && { reference: customer.reference }),
    paymentTermDays: customer.paymentTermDays,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

/**
 * Map Prisma InvoiceLine to Core InvoiceLine
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
export function toInvoiceLine(line: Prisma.InvoiceLineGetPayload<{}>): CoreInvoiceLine {
  return {
    id: line.id,
    invoiceId: line.invoiceId,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    vatRate: line.vatRate,
    amount: line.amount,
    ...(line.accountNumber != null && { accountNumber: line.accountNumber }),
  };
}

/**
 * Map Prisma Invoice (with lines) to Core Invoice
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const invoiceInclude = { lines: true } as const;

export function toInvoice(
  inv: Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>,
): CoreInvoice {
  return {
    id: inv.id,
    organizationId: inv.organizationId,
    customerId: inv.customerId,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status as CoreInvoiceStatus,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    ...(inv.paidDate != null && { paidDate: inv.paidDate }),
    ...(inv.ourReference != null && { ourReference: inv.ourReference }),
    ...(inv.yourReference != null && { yourReference: inv.yourReference }),
    ...(inv.notes != null && { notes: inv.notes }),
    subtotal: inv.subtotal,
    vatAmount: inv.vatAmount,
    totalAmount: inv.totalAmount,
    ...(inv.voucherId != null && { voucherId: inv.voucherId }),
    ...(inv.creditedInvoiceId != null && { creditedInvoiceId: inv.creditedInvoiceId }),
    ...(inv.sentAt != null && { sentAt: inv.sentAt }),
    lines: inv.lines.map(toInvoiceLine),
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  };
}

/**
 * Map Prisma BankConnection to Core BankConnection
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
export function toBankConnection(conn: Prisma.BankConnectionGetPayload<{}>): CoreBankConnection {
  return {
    id: conn.id,
    organizationId: conn.organizationId,
    provider: conn.provider,
    externalConnectionId: conn.externalConnectionId,
    ...(conn.displayName != null && { displayName: conn.displayName }),
    ...(conn.accountName != null && { accountName: conn.accountName }),
    ...(conn.accountIban != null && { accountIban: conn.accountIban }),
    ...(conn.accountLast4 != null && { accountLast4: conn.accountLast4 }),
    currency: conn.currency,
    status: conn.status as CoreBankConnectionStatus,
    ...(conn.authExpiresAt != null && { authExpiresAt: conn.authExpiresAt }),
    ...(conn.lastSyncedAt != null && { lastSyncedAt: conn.lastSyncedAt }),
    ...(conn.lastErrorCode != null && { lastErrorCode: conn.lastErrorCode }),
    ...(conn.lastErrorMessage != null && { lastErrorMessage: conn.lastErrorMessage }),
    ...(conn.metadata != null && { metadata: conn.metadata }),
    createdAt: conn.createdAt,
    updatedAt: conn.updatedAt,
  };
}

/**
 * Map Prisma BankTransaction to Core BankTransaction
 */
export function toBankTransaction(
  tx: Prisma.BankTransactionGetPayload<object>,
): CoreBankTransaction {
  return {
    id: tx.id,
    organizationId: tx.organizationId,
    connectionId: tx.connectionId,
    providerTransactionId: tx.providerTransactionId,
    bookedAt: tx.bookedAt,
    ...(tx.valueDate != null && { valueDate: tx.valueDate }),
    description: tx.description,
    amountOre: tx.amountOre,
    currency: tx.currency,
    ...(tx.reference != null && { reference: tx.reference }),
    ...(tx.counterpartyName != null && { counterpartyName: tx.counterpartyName }),
    matchStatus: tx.matchStatus as CoreBankTransactionMatchStatus,
    ...(tx.matchedVoucherId != null && { matchedVoucherId: tx.matchedVoucherId }),
    ...(tx.matchConfidence != null && { matchConfidence: tx.matchConfidence }),
    ...(tx.matchNote != null && { matchNote: tx.matchNote }),
    ...(tx.rawData != null && { rawData: tx.rawData }),
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
  };
}

/**
 * Map Prisma BankSyncRun to Core BankSyncRun
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
export function toBankSyncRun(run: Prisma.BankSyncRunGetPayload<{}>): CoreBankSyncRun {
  return {
    id: run.id,
    organizationId: run.organizationId,
    connectionId: run.connectionId,
    trigger: run.trigger as CoreBankSyncTrigger,
    status: run.status as CoreBankSyncRunStatus,
    ...(run.externalRunId != null && { externalRunId: run.externalRunId }),
    startedAt: run.startedAt,
    ...(run.completedAt != null && { completedAt: run.completedAt }),
    importedCount: run.importedCount,
    updatedCount: run.updatedCount,
    failedCount: run.failedCount,
    ...(run.errorCode != null && { errorCode: run.errorCode }),
    ...(run.errorMessage != null && { errorMessage: run.errorMessage }),
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}

/**
 * Map Prisma BankWebhookEvent to Core BankWebhookEvent
 */
export function toBankWebhookEvent(
  evt: Prisma.BankWebhookEventGetPayload<object>,
): CoreBankWebhookEvent {
  return {
    id: evt.id,
    organizationId: evt.organizationId,
    ...(evt.connectionId != null && { connectionId: evt.connectionId }),
    provider: evt.provider,
    providerEventId: evt.providerEventId,
    eventType: evt.eventType,
    status: evt.status as CoreBankWebhookEventStatus,
    signatureValidated: evt.signatureValidated,
    payload: evt.payload,
    receivedAt: evt.receivedAt,
    ...(evt.processedAt != null && { processedAt: evt.processedAt }),
    ...(evt.errorMessage != null && { errorMessage: evt.errorMessage }),
    createdAt: evt.createdAt,
    updatedAt: evt.updatedAt,
  };
}
