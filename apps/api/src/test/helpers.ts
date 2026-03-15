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
} from "@muninsbok/core/types";
import type { IReceiptOcrService, ReceiptOcrInput } from "../services/receipt-ocr.js";

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
    prisma,
  };
}

/** Build a Fastify test app with mocked repositories */
export async function buildTestApp(
  mocks?: MockRepos,
  options?: { jwtSecret?: string },
): Promise<{
  app: FastifyInstance;
  repos: MockRepos;
  documentStorage: MockedRepo<IDocumentStorage>;
  receiptOcr: MockedRepo<IReceiptOcrService>;
}> {
  const repos = mocks ?? createMockRepos();
  const documentStorage = createMockDocumentStorage();
  const receiptOcr = createMockReceiptOcr();
  const app = await buildApp({
    repos: repos as unknown as Repositories,
    documentStorage: documentStorage as unknown as IDocumentStorage,
    receiptOcr: receiptOcr as unknown as IReceiptOcrService,
    ...(options?.jwtSecret != null && { jwtSecret: options.jwtSecret }),
  });
  return { app, repos, documentStorage, receiptOcr };
}
