/**
 * Dependency injection types for API routes.
 * Allows routes to use repository interfaces instead of importing prisma directly.
 */
import type { PrismaClient } from "@prisma/client";
import {
  OrganizationRepository,
  AccountRepository,
  VoucherRepository,
  FiscalYearRepository,
} from "@muninsbok/db";

export interface Repositories {
  readonly organizations: OrganizationRepository;
  readonly accounts: AccountRepository;
  readonly vouchers: VoucherRepository;
  readonly fiscalYears: FiscalYearRepository;
  readonly prisma: PrismaClient;
}

/** Create production repositories from a PrismaClient instance */
export function createRepositories(prisma: PrismaClient): Repositories {
  return {
    organizations: new OrganizationRepository(prisma),
    accounts: new AccountRepository(prisma),
    vouchers: new VoucherRepository(prisma),
    fiscalYears: new FiscalYearRepository(prisma),
    prisma,
  };
}
