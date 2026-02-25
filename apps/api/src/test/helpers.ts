/**
 * Test helpers for API integration tests.
 * Provides mock repositories and a factory for building testable Fastify instances.
 */
import { vi } from "vitest";
import { buildApp } from "../app.js";
import type { Repositories } from "../repositories.js";
import type {
  IOrganizationRepository,
  IAccountRepository,
  IVoucherRepository,
  IFiscalYearRepository,
  IDocumentRepository,
  IUserRepository,
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
    removeMember: vi.fn(),
    findOrganizationsByUser: vi.fn(),
  } as MockedRepo<IUserRepository>;
}

interface MockPrismaModel {
  [method: string]: ReturnType<typeof vi.fn>;
}

export interface MockPrisma {
  organization: MockPrismaModel;
  fiscalYear: MockPrismaModel;
  voucher: MockPrismaModel;
  $queryRaw: ReturnType<typeof vi.fn>;
  [model: string]: MockPrismaModel | ReturnType<typeof vi.fn>;
}

export interface MockRepos {
  organizations: MockedRepo<IOrganizationRepository>;
  accounts: MockedRepo<IAccountRepository>;
  vouchers: MockedRepo<IVoucherRepository>;
  fiscalYears: MockedRepo<IFiscalYearRepository>;
  documents: MockedRepo<IDocumentRepository>;
  users: MockedRepo<IUserRepository>;
  prisma: MockPrisma;
}

export function createMockDocumentStorage() {
  return {
    generateStorageKey: vi.fn().mockReturnValue("org-1/uuid.pdf"),
    store: vi.fn().mockResolvedValue(undefined),
    read: vi.fn().mockResolvedValue(new Uint8Array([102, 97, 107, 101])),
    remove: vi.fn().mockResolvedValue(true),
  };
}

export function createMockRepos(): MockRepos {
  return {
    organizations: createMockOrganizationRepo(),
    accounts: createMockAccountRepo(),
    vouchers: createMockVoucherRepo(),
    fiscalYears: createMockFiscalYearRepo(),
    documents: createMockDocumentRepo(),
    users: createMockUserRepo(),
    prisma: {
      organization: { findUnique: vi.fn() },
      fiscalYear: { findFirst: vi.fn() },
      voucher: { findFirst: vi.fn() },
      $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    },
  };
}

/** Build a Fastify test app with mocked repositories */
export async function buildTestApp(mocks?: MockRepos) {
  const repos = mocks ?? createMockRepos();
  const documentStorage = createMockDocumentStorage();
  const app = await buildApp({
    repos: repos as unknown as Repositories,
    documentStorage,
  });
  return { app, repos, documentStorage };
}
