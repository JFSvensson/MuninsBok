/**
 * Database seed script for development.
 *
 * Creates a sample organization ("Exempelföretaget AB") with:
 * - A simplified BAS chart of accounts
 * - A fiscal year (2025-01-01 – 2025-12-31)
 * - A handful of common vouchers (opening balance, invoice, payment, salary)
 *
 * Usage:  pnpm db:seed
 *   or:   npx tsx prisma/seed.ts
 *
 * Requires DATABASE_URL to be set.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  console.error("DATABASE_URL saknas — kan inte seeda.");
  process.exit(1);
}

const adapter = new PrismaPg(connectionString);
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** öre — amounts are stored as integers in the DB */
function kr(kronor: number): number {
  return Math.round(kronor * 100);
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const SEED_ORG = {
  orgNumber: "5560001234",
  name: "Exempelföretaget AB",
  fiscalYearStartMonth: 1,
};

/** Minimal chart of accounts for a meaningful demo. */
const SEED_ACCOUNTS: { number: string; name: string; type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE"; isVatAccount?: boolean }[] = [
  // Tillgångar
  { number: "1510", name: "Kundfordringar", type: "ASSET" },
  { number: "1910", name: "Kassa", type: "ASSET" },
  { number: "1930", name: "Företagskonto", type: "ASSET" },
  { number: "1940", name: "Placeringskonto", type: "ASSET" },
  // Skulder
  { number: "2440", name: "Leverantörsskulder", type: "LIABILITY" },
  { number: "2610", name: "Utgående moms 25%", type: "LIABILITY", isVatAccount: true },
  { number: "2640", name: "Ingående moms", type: "LIABILITY", isVatAccount: true },
  { number: "2710", name: "Personalens källskatt", type: "LIABILITY" },
  { number: "2730", name: "Arbetsgivaravgifter, skuld", type: "LIABILITY" },
  // Eget kapital
  { number: "2081", name: "Aktiekapital", type: "EQUITY" },
  { number: "2091", name: "Balanserad vinst/förlust", type: "EQUITY" },
  // Intäkter
  { number: "3010", name: "Försäljning tjänster, 25% moms", type: "REVENUE" },
  { number: "3040", name: "Försäljning tjänster, momsfri", type: "REVENUE" },
  // Kostnader
  { number: "4010", name: "Inköp material", type: "EXPENSE" },
  { number: "5010", name: "Lokalhyra", type: "EXPENSE" },
  { number: "5410", name: "Förbrukningsinventarier", type: "EXPENSE" },
  { number: "6110", name: "Kontorsmaterial", type: "EXPENSE" },
  { number: "6210", name: "Telefon & internet", type: "EXPENSE" },
  { number: "7010", name: "Löner tjänstemän", type: "EXPENSE" },
  { number: "7510", name: "Arbetsgivaravgifter", type: "EXPENSE" },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("🌱 Seedar databasen …");

  // 1. Upsert organisation
  const org = await prisma.organization.upsert({
    where: { orgNumber: SEED_ORG.orgNumber },
    update: { name: SEED_ORG.name },
    create: SEED_ORG,
  });
  console.log(`  Organisation: ${org.name} (${org.id})`);

  // 2. Create accounts (skip if they already exist)
  const existingAccounts = await prisma.account.findMany({
    where: { organizationId: org.id },
    select: { number: true },
  });
  const existingNumbers = new Set(existingAccounts.map((a) => a.number));

  const newAccounts = SEED_ACCOUNTS.filter((a) => !existingNumbers.has(a.number));
  if (newAccounts.length > 0) {
    await prisma.account.createMany({
      data: newAccounts.map((a) => ({
        organizationId: org.id,
        number: a.number,
        name: a.name,
        type: a.type,
        isVatAccount: a.isVatAccount ?? false,
      })),
    });
  }
  console.log(`  Konton: ${SEED_ACCOUNTS.length} (${newAccounts.length} nya)`);

  // 3. Fiscal year
  const fyStart = new Date("2025-01-01T00:00:00Z");
  const fyEnd = new Date("2025-12-31T00:00:00Z");

  const fy = await prisma.fiscalYear.upsert({
    where: {
      organizationId_startDate: {
        organizationId: org.id,
        startDate: fyStart,
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      startDate: fyStart,
      endDate: fyEnd,
    },
  });
  console.log(`  Räkenskapsår: ${fy.startDate.toISOString().slice(0, 10)} – ${fy.endDate.toISOString().slice(0, 10)}`);

  // 4. Look up account IDs for voucher lines
  const accounts = await prisma.account.findMany({
    where: { organizationId: org.id },
    select: { id: true, number: true },
  });
  const accountMap = new Map(accounts.map((a) => [a.number, a.id]));

  function acctId(number: string): string {
    const id = accountMap.get(number);
    if (!id) throw new Error(`Konto ${number} saknas — kör seed igen efter migrering`);
    return id;
  }

  // 5. Seed vouchers (skip if any already exist)
  const existingVouchers = await prisma.voucher.count({
    where: { organizationId: org.id, fiscalYearId: fy.id },
  });

  if (existingVouchers > 0) {
    console.log(`  Verifikat: ${existingVouchers} finns redan — hoppar över`);
  } else {
    // V1 — Ingående balans
    await prisma.voucher.create({
      data: {
        organizationId: org.id,
        fiscalYearId: fy.id,
        number: 1,
        date: new Date("2025-01-01T00:00:00Z"),
        description: "Ingående balans",
        lines: {
          create: [
            { accountId: acctId("1930"), accountNumber: "1930", debit: kr(150_000), credit: 0 },
            { accountId: acctId("2081"), accountNumber: "2081", debit: 0, credit: kr(50_000) },
            { accountId: acctId("2091"), accountNumber: "2091", debit: 0, credit: kr(100_000) },
          ],
        },
      },
    });

    // V2 — Kundfaktura #1001
    await prisma.voucher.create({
      data: {
        organizationId: org.id,
        fiscalYearId: fy.id,
        number: 2,
        date: new Date("2025-01-15T00:00:00Z"),
        description: "Kundfaktura #1001 – konsultuppdrag",
        lines: {
          create: [
            { accountId: acctId("1510"), accountNumber: "1510", debit: kr(25_000), credit: 0 },
            { accountId: acctId("3010"), accountNumber: "3010", debit: 0, credit: kr(20_000) },
            { accountId: acctId("2610"), accountNumber: "2610", debit: 0, credit: kr(5_000) },
          ],
        },
      },
    });

    // V3 — Betalning från kund
    await prisma.voucher.create({
      data: {
        organizationId: org.id,
        fiscalYearId: fy.id,
        number: 3,
        date: new Date("2025-02-01T00:00:00Z"),
        description: "Betalning kundfaktura #1001",
        lines: {
          create: [
            { accountId: acctId("1930"), accountNumber: "1930", debit: kr(25_000), credit: 0 },
            { accountId: acctId("1510"), accountNumber: "1510", debit: 0, credit: kr(25_000) },
          ],
        },
      },
    });

    // V4 — Hyra kontor januari
    await prisma.voucher.create({
      data: {
        organizationId: org.id,
        fiscalYearId: fy.id,
        number: 4,
        date: new Date("2025-01-31T00:00:00Z"),
        description: "Hyra kontor januari",
        lines: {
          create: [
            { accountId: acctId("5010"), accountNumber: "5010", debit: kr(12_000), credit: 0 },
            { accountId: acctId("1930"), accountNumber: "1930", debit: 0, credit: kr(12_000) },
          ],
        },
      },
    });

    // V5 — Lön anställd januari
    await prisma.voucher.create({
      data: {
        organizationId: org.id,
        fiscalYearId: fy.id,
        number: 5,
        date: new Date("2025-01-25T00:00:00Z"),
        description: "Lön januari — Anna Svensson",
        lines: {
          create: [
            { accountId: acctId("7010"), accountNumber: "7010", debit: kr(35_000), credit: 0 },
            { accountId: acctId("7510"), accountNumber: "7510", debit: kr(10_990), credit: 0 },
            { accountId: acctId("2710"), accountNumber: "2710", debit: 0, credit: kr(10_500) },
            { accountId: acctId("2730"), accountNumber: "2730", debit: 0, credit: kr(10_990) },
            { accountId: acctId("1930"), accountNumber: "1930", debit: 0, credit: kr(24_500) },
          ],
        },
      },
    });

    console.log("  Verifikat: 5 skapade (IB, faktura, betalning, hyra, lön)");
  }

  console.log("✅ Seed klar!");
}

main()
  .catch((e: unknown) => {
    console.error("Seed misslyckades:", e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
