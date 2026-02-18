/**
 * Test helpers for API integration tests.
 * Provides mock repositories and a factory for building testable Fastify instances.
 */
import { vi } from "vitest";
import { buildApp } from "../app.js";
import type { Repositories } from "../repositories.js";
import type { OrganizationRepository, AccountRepository, VoucherRepository, FiscalYearRepository, DocumentRepository } from "@muninsbok/db";

type MockedRepo<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? ReturnType<typeof vi.fn> : T[K];
};

export function createMockOrganizationRepo(): MockedRepo<OrganizationRepository> {
  return {
    findById: vi.fn(),
    findByOrgNumber: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as any;
}

export function createMockAccountRepo(): MockedRepo<AccountRepository> {
  return {
    findByOrganization: vi.fn(),
    findActive: vi.fn(),
    findByNumber: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    deactivate: vi.fn(),
    update: vi.fn(),
  } as any;
}

export function createMockVoucherRepo(): MockedRepo<VoucherRepository> {
  return {
    findById: vi.fn(),
    findByFiscalYear: vi.fn(),
    findByFiscalYearPaginated: vi.fn(),
    findByDateRange: vi.fn(),
    create: vi.fn(),
    createCorrection: vi.fn(),
    findNumberGaps: vi.fn(),
  } as any;
}

export function createMockFiscalYearRepo(): MockedRepo<FiscalYearRepository> {
  return {
    findByOrganization: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    close: vi.fn(),
    createOpeningBalances: vi.fn(),
  } as any;
}

export function createMockDocumentRepo(): MockedRepo<DocumentRepository> {
  return {
    findById: vi.fn(),
    findByVoucher: vi.fn(),
    findByOrganization: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  } as any;
}

export interface MockRepos {
  organizations: MockedRepo<OrganizationRepository>;
  accounts: MockedRepo<AccountRepository>;
  vouchers: MockedRepo<VoucherRepository>;
  fiscalYears: MockedRepo<FiscalYearRepository>;
  documents: MockedRepo<DocumentRepository>;
  prisma: any;
}

export function createMockRepos(): MockRepos {
  return {
    organizations: createMockOrganizationRepo(),
    accounts: createMockAccountRepo(),
    vouchers: createMockVoucherRepo(),
    fiscalYears: createMockFiscalYearRepo(),
    documents: createMockDocumentRepo(),
    prisma: {
      organization: { findUnique: vi.fn() },
      fiscalYear: { findFirst: vi.fn() },
      $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    },
  };
}

/** Build a Fastify test app with mocked repositories */
export async function buildTestApp(mocks?: MockRepos) {
  const repos = mocks ?? createMockRepos();
  const app = await buildApp({ repos: repos as unknown as Repositories });
  return { app, repos };
}
