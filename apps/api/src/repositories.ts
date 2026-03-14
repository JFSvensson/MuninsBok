/**
 * Dependency injection types for API routes.
 * Routes depend on interfaces (from @muninsbok/core), not concrete classes.
 */
import type {
  IOrganizationRepository,
  IAccountRepository,
  IVoucherRepository,
  IVoucherTemplateRepository,
  IBudgetRepository,
  IFiscalYearRepository,
  IDocumentRepository,
  IUserRepository,
  IRefreshTokenRepository,
  IApprovalRuleRepository,
  IApprovalStepRepository,
  ICustomerRepository,
  IInvoiceRepository,
} from "@muninsbok/core/types";
import {
  type PrismaClient,
  OrganizationRepository,
  AccountRepository,
  VoucherRepository,
  VoucherTemplateRepository,
  BudgetRepository,
  FiscalYearRepository,
  DocumentRepository,
  UserRepository,
  RefreshTokenRepository,
  ApprovalRuleRepository,
  ApprovalStepRepository,
  CustomerRepository,
  InvoiceRepository,
} from "@muninsbok/db";

export interface Repositories {
  readonly organizations: IOrganizationRepository;
  readonly accounts: IAccountRepository;
  readonly vouchers: IVoucherRepository;
  readonly voucherTemplates: IVoucherTemplateRepository;
  readonly budgets: IBudgetRepository;
  readonly fiscalYears: IFiscalYearRepository;
  readonly documents: IDocumentRepository;
  readonly users: IUserRepository;
  readonly refreshTokens: IRefreshTokenRepository;
  readonly approvalRules: IApprovalRuleRepository;
  readonly approvalSteps: IApprovalStepRepository;
  readonly customers: ICustomerRepository;
  readonly invoices: IInvoiceRepository;
  readonly prisma: PrismaClient;
}

/** Create production repositories from a PrismaClient instance */
export function createRepositories(prisma: PrismaClient): Repositories {
  return {
    organizations: new OrganizationRepository(prisma),
    accounts: new AccountRepository(prisma),
    vouchers: new VoucherRepository(prisma),
    voucherTemplates: new VoucherTemplateRepository(prisma),
    budgets: new BudgetRepository(prisma),
    fiscalYears: new FiscalYearRepository(prisma),
    documents: new DocumentRepository(prisma),
    users: new UserRepository(prisma),
    refreshTokens: new RefreshTokenRepository(prisma),
    approvalRules: new ApprovalRuleRepository(prisma),
    approvalSteps: new ApprovalStepRepository(prisma),
    customers: new CustomerRepository(prisma),
    invoices: new InvoiceRepository(prisma),
    prisma,
  };
}
