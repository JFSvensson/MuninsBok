/**
 * Test helpers for API integration tests.
 * Provides mock repositories and a factory for building testable Fastify instances.
 */
import { vi } from "vitest";
import { buildApp } from "../app.js";
import type { Repositories } from "../repositories.js";
import type { FastifyInstance } from "fastify";
import type {
  IOrganizationRepository,
  IAccountRepository,
  IVoucherRepository,
  IVoucherTemplateRepository,
  IBudgetRepository,
  IFiscalYearRepository,
  IDocumentRepository,
  IDocumentStorage,
  IUserRepository,
  IRefreshTokenRepository,
  IApprovalRuleRepository,
  IApprovalStepRepository,
  ICustomerRepository,
  IInvoiceRepository,
  IBankConnectionRepository,
  IBankTransactionRepository,
  IBankSyncRunRepository,
  IBankWebhookEventRepository,
} from "@muninsbok/core/types";
import type { IReceiptOcrService, ReceiptOcrInput } from "../services/receipt-ocr.js";
import type { IAggregatorBankAdapter } from "../services/bank-adapter.js";

type MockedRepo<T> = {
  [K in keyof T]: T[K] extends (...args: infer _Args) => infer _Return
    ? ReturnType<typeof vi.fn>
    : T[K];
};

/** Default mock organization returned by the org-scope preHandler. */
const DEFAULT_ORG = {
  id: "org-1",
  orgNumber: "5591234567",
  name: "Test AB",
  fiscalYearStartMonth: 1,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

export function createMockOrganizationRepo(): MockedRepo<IOrganizationRepository> {
  return {
    findById: vi.fn().mockResolvedValue(DEFAULT_ORG),
    findByOrgNumber: vi.fn(),
    findAll: vi.fn(),
    findByUserMembership: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as MockedRepo<IOrganizationRepository>;
}

export function createMockAccountRepo(): MockedRepo<IAccountRepository> {
  return {
    findByOrganization: vi.fn(),
    findActive: vi.fn(),
    findByNumber: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    deactivate: vi.fn(),
    update: vi.fn(),
  } as MockedRepo<IAccountRepository>;
}

export function createMockVoucherRepo(): MockedRepo<IVoucherRepository> {
  return {
    findById: vi.fn(),
    findByFiscalYear: vi.fn(),
    findByFiscalYearPaginated: vi.fn(),
    findByDateRange: vi.fn(),
    create: vi.fn(),
    createCorrection: vi.fn(),
    getNextVoucherNumber: vi.fn(),
    findNumberGaps: vi.fn(),
    isVoucherInClosedFiscalYear: vi.fn().mockResolvedValue(false),
  } as MockedRepo<IVoucherRepository>;
}

export function createMockFiscalYearRepo(): MockedRepo<IFiscalYearRepository> {
  return {
    findByOrganization: vi.fn(),
    findById: vi.fn(),
    findPreviousByDate: vi.fn(),
    create: vi.fn(),
    close: vi.fn(),
    createOpeningBalances: vi.fn(),
    executeResultDisposition: vi.fn(),
  } as MockedRepo<IFiscalYearRepository>;
}

export function createMockDocumentRepo(): MockedRepo<IDocumentRepository> {
  return {
    findById: vi.fn(),
    findByVoucher: vi.fn(),
    findByOrganization: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  } as MockedRepo<IDocumentRepository>;
}

export function createMockUserRepo(): MockedRepo<IUserRepository> {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
    recordFailedLogin: vi.fn(),
    resetFailedLogins: vi.fn(),
    updatePasswordHash: vi.fn(),
    findMembersByOrganization: vi.fn(),
    findMembership: vi.fn(),
    addMember: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
    findOrganizationsByUser: vi.fn(),
  } as MockedRepo<IUserRepository>;
}

export function createMockRefreshTokenRepo(): MockedRepo<IRefreshTokenRepository> {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    existsByJti: vi.fn().mockResolvedValue(true),
    revokeByJti: vi.fn().mockResolvedValue(undefined),
    revokeByJtiIfExists: vi.fn().mockResolvedValue(true),
    revokeAllByUserId: vi.fn().mockResolvedValue(undefined),
    cleanupExpired: vi.fn().mockResolvedValue(0),
  } as MockedRepo<IRefreshTokenRepository>;
}

export function createMockVoucherTemplateRepo(): MockedRepo<IVoucherTemplateRepository> {
  return {
    findByOrganization: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findDueRecurring: vi.fn().mockResolvedValue([]),
    updateRecurringSchedule: vi.fn(),
    markRecurringRun: vi.fn().mockResolvedValue(undefined),
  } as MockedRepo<IVoucherTemplateRepository>;
}

export function createMockBudgetRepo(): MockedRepo<IBudgetRepository> {
  return {
    findByOrganization: vi.fn().mockResolvedValue([]),
    findByFiscalYear: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as MockedRepo<IBudgetRepository>;
}

export function createMockApprovalRuleRepo(): MockedRepo<IApprovalRuleRepository> {
  return {
    findByOrganization: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    findMatchingRules: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as MockedRepo<IApprovalRuleRepository>;
}

export function createMockApprovalStepRepo(): MockedRepo<IApprovalStepRepository> {
  return {
    findByVoucher: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    findPendingByOrganization: vi.fn().mockResolvedValue([]),
    createMany: vi.fn().mockResolvedValue([]),
    decide: vi.fn(),
  } as MockedRepo<IApprovalStepRepository>;
}

export function createMockCustomerRepo(): MockedRepo<ICustomerRepository> {
  return {
    findByOrganization: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    getNextCustomerNumber: vi.fn().mockResolvedValue(1),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as MockedRepo<ICustomerRepository>;
}

export function createMockInvoiceRepo(): MockedRepo<IInvoiceRepository> {
  return {
    findByOrganization: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    findByCustomer: vi.fn().mockResolvedValue([]),
    findByStatus: vi.fn().mockResolvedValue([]),
    getNextInvoiceNumber: vi.fn().mockResolvedValue(1),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    delete: vi.fn(),
  } as MockedRepo<IInvoiceRepository>;
}

export function createMockBankConnectionRepo(): MockedRepo<IBankConnectionRepository> {
  return {
    findByOrganization: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    findByExternalConnectionId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    delete: vi.fn(),
  } as MockedRepo<IBankConnectionRepository>;
}

export function createMockBankTransactionRepo(): MockedRepo<IBankTransactionRepository> {
  return {
    findById: vi.fn(),
    findByConnectionPaginated: vi.fn().mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
    }),
    findUnmatchedByOrganization: vi.fn().mockResolvedValue([]),
    upsertMany: vi.fn(),
    updateMatch: vi.fn(),
    updateMatchMany: vi.fn().mockResolvedValue(0),
    deleteByConnection: vi.fn().mockResolvedValue(0),
  } as MockedRepo<IBankTransactionRepository>;
}

export function createMockBankSyncRunRepo(): MockedRepo<IBankSyncRunRepository> {
  return {
    findById: vi.fn(),
    findLatestByConnection: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    markRunning: vi.fn(),
    complete: vi.fn(),
  } as MockedRepo<IBankSyncRunRepository>;
}

export function createMockBankWebhookEventRepo(): MockedRepo<IBankWebhookEventRepository> {
  return {
    findById: vi.fn(),
    findByProviderEventId: vi.fn(),
    listRecentByOrganization: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
  } as MockedRepo<IBankWebhookEventRepository>;
}

interface MockPrismaModel {
  findUnique: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  [method: string]: ReturnType<typeof vi.fn>;
}

export interface MockPrisma {
  organization: MockPrismaModel;
  fiscalYear: MockPrismaModel;
  voucher: MockPrismaModel;
  $queryRaw: ReturnType<typeof vi.fn>;
  $transaction: ReturnType<typeof vi.fn>;
  [model: string]: MockPrismaModel | ReturnType<typeof vi.fn>;
}

export interface MockRepos {
  organizations: MockedRepo<IOrganizationRepository>;
  accounts: MockedRepo<IAccountRepository>;
  vouchers: MockedRepo<IVoucherRepository>;
  voucherTemplates: MockedRepo<IVoucherTemplateRepository>;
  budgets: MockedRepo<IBudgetRepository>;
  fiscalYears: MockedRepo<IFiscalYearRepository>;
  documents: MockedRepo<IDocumentRepository>;
  users: MockedRepo<IUserRepository>;
  refreshTokens: MockedRepo<IRefreshTokenRepository>;
  approvalRules: MockedRepo<IApprovalRuleRepository>;
  approvalSteps: MockedRepo<IApprovalStepRepository>;
  customers: MockedRepo<ICustomerRepository>;
  invoices: MockedRepo<IInvoiceRepository>;
  bankConnections: MockedRepo<IBankConnectionRepository>;
  bankTransactions: MockedRepo<IBankTransactionRepository>;
  bankSyncRuns: MockedRepo<IBankSyncRunRepository>;
  bankWebhookEvents: MockedRepo<IBankWebhookEventRepository>;
  prisma: MockPrisma;
}

export function createMockDocumentStorage(): MockedRepo<IDocumentStorage> {
  return {
    generateStorageKey: vi.fn().mockReturnValue("org-1/uuid.pdf"),
    store: vi.fn().mockResolvedValue(undefined),
    read: vi.fn().mockResolvedValue(new Uint8Array([102, 97, 107, 101])),
    remove: vi.fn().mockResolvedValue(true),
  };
}

export function createMockReceiptOcr(): MockedRepo<IReceiptOcrService> {
  return {
    analyze: vi.fn().mockImplementation(async (input: ReceiptOcrInput) => ({
      sourceFilename: input.filename,
      mimeType: input.mimeType,
      extractedText: "ICA Nara\nDatum 2025-02-01\nSumma 123,45",
      confidence: 82,
      merchantName: "ICA Nara",
      transactionDate: "2025-02-01",
      totalAmountOre: 12345,
      currency: "SEK",
      suggestedDescription: "Kvitto ICA Nara",
      prefillLines: [
        { debit: 12345, credit: 0, description: "Kvitto ICA Nara" },
        { debit: 0, credit: 12345, description: "Betalning" },
      ],
      warnings: [],
    })),
  } as MockedRepo<IReceiptOcrService>;
}

export function createMockBankAdapter(): MockedRepo<IAggregatorBankAdapter> {
  return {
    provider: "sandbox",
    createAuthorizationUrl: vi.fn().mockResolvedValue({
      authorizationUrl: "https://sandbox.aggregator.local/oauth/authorize?state=test",
      state: "test",
      expiresAt: new Date("2026-01-01T00:00:00.000Z"),
    }),
    exchangeAuthorizationCode: vi.fn().mockResolvedValue({
      accessToken: "sbx_at_test",
      refreshToken: "sbx_rt_test",
      expiresAt: new Date("2026-01-01T01:00:00.000Z"),
      tokenType: "Bearer",
      scope: ["accounts", "transactions"],
    }),
    refreshAccessToken: vi.fn().mockResolvedValue({
      accessToken: "sbx_at_refresh",
      refreshToken: "sbx_rt_test",
      expiresAt: new Date("2026-01-01T02:00:00.000Z"),
      tokenType: "Bearer",
      scope: ["accounts", "transactions"],
    }),
    fetchTransactions: vi.fn().mockResolvedValue({
      transactions: [],
    }),
  } as MockedRepo<IAggregatorBankAdapter>;
}

export function createMockRepos(): MockRepos {
  const prisma: MockPrisma = {
    organization: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    fiscalYear: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    voucher: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    $transaction: vi.fn(),
  };

  // Default: $transaction executes its callback with the mock prisma itself
  (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation((fn: unknown) =>
    (fn as (...args: unknown[]) => unknown)(prisma),
  );

  return {
    organizations: createMockOrganizationRepo(),
    accounts: createMockAccountRepo(),
    vouchers: createMockVoucherRepo(),
    voucherTemplates: createMockVoucherTemplateRepo(),
    budgets: createMockBudgetRepo(),
    fiscalYears: createMockFiscalYearRepo(),
    documents: createMockDocumentRepo(),
    users: createMockUserRepo(),
    refreshTokens: createMockRefreshTokenRepo(),
    approvalRules: createMockApprovalRuleRepo(),
    approvalSteps: createMockApprovalStepRepo(),
    customers: createMockCustomerRepo(),
    invoices: createMockInvoiceRepo(),
    bankConnections: createMockBankConnectionRepo(),
    bankTransactions: createMockBankTransactionRepo(),
    bankSyncRuns: createMockBankSyncRunRepo(),
    bankWebhookEvents: createMockBankWebhookEventRepo(),
    prisma,
  };
}

/** Build a Fastify test app with mocked repositories */
export async function buildTestApp(
  mocks?: MockRepos,
  options?: {
    jwtSecret?: string;
    isProduction?: boolean;
    enableDocs?: boolean;
    metricsToken?: string;
  },
): Promise<{
  app: FastifyInstance;
  repos: MockRepos;
  documentStorage: MockedRepo<IDocumentStorage>;
  receiptOcr: MockedRepo<IReceiptOcrService>;
  bankAdapter: MockedRepo<IAggregatorBankAdapter>;
}> {
  const repos = mocks ?? createMockRepos();
  const documentStorage = createMockDocumentStorage();
  const receiptOcr = createMockReceiptOcr();
  const bankAdapter = createMockBankAdapter();
  const app = await buildApp({
    repos: repos as unknown as Repositories,
    documentStorage: documentStorage as unknown as IDocumentStorage,
    receiptOcr: receiptOcr as unknown as IReceiptOcrService,
    bankAdapter: bankAdapter as unknown as IAggregatorBankAdapter,
    ...(options?.jwtSecret != null && { jwtSecret: options.jwtSecret }),
    ...(options?.isProduction != null && { isProduction: options.isProduction }),
    ...(options?.enableDocs != null && { enableDocs: options.enableDocs }),
    ...(options?.metricsToken != null && { metricsToken: options.metricsToken }),
  });
  return { app, repos, documentStorage, receiptOcr, bankAdapter };
}
