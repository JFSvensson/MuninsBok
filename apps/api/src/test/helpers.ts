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
  IFiscalYearRepository,
  IDocumentRepository,
  IDocumentStorage,
  IUserRepository,
  IRefreshTokenRepository,
} from "@muninsbok/core/types";

type MockedRepo<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- conditional type guard requires `any` for function detection
  [K in keyof T]: T[K] extends (...args: any[]) => any ? ReturnType<typeof vi.fn> : T[K];
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
  } as MockedRepo<IVoucherTemplateRepository>;
}

interface MockPrismaModel {
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
  fiscalYears: MockedRepo<IFiscalYearRepository>;
  documents: MockedRepo<IDocumentRepository>;
  users: MockedRepo<IUserRepository>;
  refreshTokens: MockedRepo<IRefreshTokenRepository>;
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

export function createMockRepos(): MockRepos {
  const prisma: MockPrisma = {
    organization: { findUnique: vi.fn() },
    fiscalYear: { findFirst: vi.fn() },
    voucher: { findFirst: vi.fn() },
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
    fiscalYears: createMockFiscalYearRepo(),
    documents: createMockDocumentRepo(),
    users: createMockUserRepo(),
    refreshTokens: createMockRefreshTokenRepo(),
    prisma,
  };
}

/** Build a Fastify test app with mocked repositories */
export async function buildTestApp(mocks?: MockRepos, options?: { jwtSecret?: string }): Promise<{ app: FastifyInstance; repos: MockRepos; documentStorage: MockedRepo<IDocumentStorage> }> {
  const repos = mocks ?? createMockRepos();
  const documentStorage = createMockDocumentStorage();
  const app = await buildApp({
    repos: repos as unknown as Repositories,
    documentStorage: documentStorage as unknown as IDocumentStorage,
    ...(options?.jwtSecret != null && { jwtSecret: options.jwtSecret }),
  });
  return { app, repos, documentStorage };
}
