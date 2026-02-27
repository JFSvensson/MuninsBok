import type { FastifyInstance } from "fastify";
import { parseSie, exportSie } from "@muninsbok/core/sie";
import { getAccountTypeFromNumber } from "@muninsbok/core/types";
import { type PrismaClient, AccountRepository, VoucherRepository } from "@muninsbok/db";

/** Thrown inside the import transaction to trigger rollback and report errors. */
class SieImportError extends Error {
  constructor(public readonly details: string[]) {
    super(`SIE-import misslyckades: ${details.length} fel`);
    this.name = "SieImportError";
  }
}

export async function sieRoutes(fastify: FastifyInstance) {
  const fyRepo = fastify.repos.fiscalYears;
  const voucherRepo = fastify.repos.vouchers;
  const accountRepo = fastify.repos.accounts;

  // Export SIE4
  fastify.get<{
    Params: { orgId: string };
    Querystring: { fiscalYearId: string };
  }>("/:orgId/sie/export", async (request, reply) => {
    const { orgId } = request.params;
    const { fiscalYearId } = request.query;

    if (!fiscalYearId) {
      return reply.status(400).send({ error: "fiscalYearId krävs" });
    }

    // All data via repository interfaces — no raw Prisma
    // NOTE: Loads all vouchers into memory. Acceptable for SMB volumes
    // (up to ~10 000 vouchers/year). For very large datasets, consider
    // streaming or chunked processing in a future iteration.
    const org = request.org;
    if (!org) return reply.status(500).send({ error: "Missing org context" });
    const [fiscalYear, accounts, vouchers] = await Promise.all([
      fyRepo.findById(fiscalYearId, orgId),
      accountRepo.findByOrganization(orgId),
      voucherRepo.findByFiscalYear(fiscalYearId, orgId),
    ]);

    if (!fiscalYear) {
      return reply.status(404).send({ error: "Räkenskapsåret hittades inte" });
    }

    // Calculate opening balances from previous fiscal year
    const openingBalances = new Map<string, number>();
    const previousFy = await fyRepo.findPreviousByDate(orgId, fiscalYear.startDate);

    if (previousFy) {
      const prevVouchers = await voucherRepo.findByFiscalYear(previousFy.id, orgId);

      for (const v of prevVouchers) {
        for (const line of v.lines) {
          const num = parseInt(line.accountNumber, 10);
          if (num >= 1000 && num <= 2999) {
            const existing = openingBalances.get(line.accountNumber) ?? 0;
            openingBalances.set(line.accountNumber, existing + line.debit - line.credit);
          }
        }
      }
    }

    // Calculate closing balances (UB) and result balances (RES) from current year
    const closingBalances = new Map<string, number>();
    const resultBalances = new Map<string, number>();

    // Start with opening balances for closing balances
    for (const [accountNumber, balance] of openingBalances) {
      closingBalances.set(accountNumber, balance);
    }

    // Add current year transactions
    for (const voucher of vouchers) {
      for (const line of voucher.lines) {
        const num = parseInt(line.accountNumber, 10);
        const net = line.debit - line.credit;

        if (num >= 1000 && num <= 2999) {
          // Balance sheet accounts → UB
          const existing = closingBalances.get(line.accountNumber) ?? 0;
          closingBalances.set(line.accountNumber, existing + net);
        } else if (num >= 3000 && num <= 8999) {
          // P&L accounts → RES
          const existing = resultBalances.get(line.accountNumber) ?? 0;
          resultBalances.set(line.accountNumber, existing + net);
        }
      }
    }

    const sieContent = exportSie({
      companyName: org.name,
      orgNumber: org.orgNumber,
      programName: "Munins bok",
      programVersion: "0.1.0",
      fiscalYear,
      accounts,
      vouchers,
      openingBalances,
      closingBalances,
      resultBalances,
    });

    // Return as SIE file
    reply.header("Content-Type", "text/plain; charset=cp437");
    reply.header(
      "Content-Disposition",
      `attachment; filename="${org.name.replace(/[^a-zA-Z0-9]/g, "_")}_${fiscalYear.startDate.getFullYear()}.se"`,
    );

    return sieContent;
  });

  // Import SIE4
  fastify.post<{
    Params: { orgId: string };
    Querystring: { fiscalYearId: string };
  }>("/:orgId/sie/import", async (request, reply) => {
    const { orgId } = request.params;
    const { fiscalYearId } = request.query;

    if (!fiscalYearId) {
      return reply.status(400).send({ error: "fiscalYearId krävs" });
    }

    // Get the raw body as string
    const content = request.body as string;

    if (!content || typeof content !== "string") {
      return reply.status(400).send({ error: "SIE-filinnehåll krävs" });
    }

    // Parse SIE file
    const parseResult = parseSie(content);

    if (!parseResult.ok) {
      return reply.status(400).send({
        error: "Failed to parse SIE file",
        details: parseResult.error,
      });
    }

    const sieFile = parseResult.value;

    // Get existing accounts for the organization
    const existingAccounts = await accountRepo.findByOrganization(orgId);
    const existingAccountNumbers = new Set(existingAccounts.map((a) => a.number));

    // Import accounts that don't exist
    const newAccounts = sieFile.accounts.filter((a) => !existingAccountNumbers.has(a.number));

    // Wrap entire import in a transaction to ensure atomicity
    const prisma = fastify.repos.prisma;
    try {
      const result = await prisma.$transaction(async (tx) => {
        // tx is Omit<PrismaClient, ...> — safe to cast for repository constructors
        // which only use model accessors
        const txAccountRepo = new AccountRepository(tx as unknown as PrismaClient);
        const txVoucherRepo = new VoucherRepository(tx as unknown as PrismaClient);

        if (newAccounts.length > 0) {
          await txAccountRepo.createMany(
            orgId,
            newAccounts.map((a) => ({
              number: a.number,
              name: a.name,
              type: getAccountTypeFromNumber(a.number),
            })),
          );
        }

        // Import vouchers (sequential creates via repository)
        let importedCount = 0;
        const errors: string[] = [];

        for (const sieVoucher of sieFile.vouchers) {
          // Convert SIE transactions to voucher lines
          const lines = sieVoucher.transactions.map((t) => ({
            accountNumber: t.accountNumber,
            debit: t.amount > 0 ? t.amount : 0,
            credit: t.amount < 0 ? -t.amount : 0,
            ...(t.description != null && { description: t.description }),
          }));

          const vResult = await txVoucherRepo.create({
            organizationId: orgId,
            fiscalYearId,
            date: sieVoucher.date,
            description:
              sieVoucher.description || `Import ${sieVoucher.series}${sieVoucher.number}`,
            lines,
          });

          if (vResult.ok) {
            importedCount++;
          } else {
            errors.push(
              `Verifikat ${sieVoucher.series}${sieVoucher.number}: ${vResult.error.message}`,
            );
          }
        }

        if (errors.length > 0) {
          throw new SieImportError(errors);
        }

        return { importedCount };
      });

      return {
        data: {
          companyName: sieFile.companyName,
          accountsImported: newAccounts.length,
          vouchersImported: result.importedCount,
          vouchersWithErrors: 0,
        },
      };
    } catch (err) {
      if (err instanceof SieImportError) {
        return reply.status(400).send({
          error: `Import avbruten — ${err.details.length} verifikat med fel`,
          details: err.details,
        });
      }
      throw err;
    }
  });
}
