import type { FastifyInstance } from "fastify";
import { toFiscalYear } from "@muninsbok/db";
import { parseSie, exportSie, getAccountTypeFromNumber } from "@muninsbok/core";

export async function sieRoutes(fastify: FastifyInstance) {
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

    // Get organization, fiscal year, accounts, and vouchers
    const db = fastify.repos.prisma;
    const [org, fiscalYear, accounts, vouchers] = await Promise.all([
      db.organization.findUnique({ where: { id: orgId } }),
      db.fiscalYear.findFirst({ where: { id: fiscalYearId, organizationId: orgId } }),
      accountRepo.findByOrganization(orgId),
      voucherRepo.findByFiscalYear(fiscalYearId, orgId),
    ]);

    if (!org) {
      return reply.status(404).send({ error: "Organisationen hittades inte" });
    }

    if (!fiscalYear) {
      return reply.status(404).send({ error: "Räkenskapsåret hittades inte" });
    }

    // Calculate opening balances from previous fiscal year
    const openingBalances = new Map<string, number>();
    const previousFy = await db.fiscalYear.findFirst({
      where: {
        organizationId: orgId,
        endDate: { lt: fiscalYear.startDate },
      },
      orderBy: { endDate: "desc" },
    });

    if (previousFy) {
      const prevVouchers = await db.voucher.findMany({
        where: { fiscalYearId: previousFy.id, organizationId: orgId },
        include: { lines: true },
      });

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
      fiscalYear: toFiscalYear(fiscalYear),
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

    if (newAccounts.length > 0) {
      await accountRepo.createMany(
        orgId,
        newAccounts.map((a) => ({
          number: a.number,
          name: a.name,
          type: getAccountTypeFromNumber(a.number),
        })),
      );
    }

    // Import vouchers inside a transaction (all-or-nothing)
    const db = fastify.repos.prisma;
    let importedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      await db.$transaction(async (tx: any) => {
        for (const sieVoucher of sieFile.vouchers) {
          // Convert SIE transactions to voucher lines
          const lines = sieVoucher.transactions.map((t) => ({
            accountNumber: t.accountNumber,
            debit: t.amount > 0 ? t.amount : 0,
            credit: t.amount < 0 ? -t.amount : 0,
            ...(t.description != null && { description: t.description }),
          }));

          const result = await voucherRepo.create({
            organizationId: orgId,
            fiscalYearId,
            date: sieVoucher.date,
            description:
              sieVoucher.description || `Import ${sieVoucher.series}${sieVoucher.number}`,
            lines,
          });

          if (result.ok) {
            importedCount++;
          } else {
            errorCount++;
            errors.push(
              `Verifikat ${sieVoucher.series}${sieVoucher.number}: ${result.error.message}`,
            );
          }
        }

        // If any voucher failed, abort the entire transaction
        if (errorCount > 0) {
          throw new Error(`${errorCount} verifikat kunde inte importeras`);
        }
      });
    } catch (txError) {
      if (errorCount > 0) {
        return reply.status(400).send({
          error: `Import avbruten — ${errorCount} verifikat med fel`,
          details: errors,
        });
      }
      throw txError; // Re-throw unexpected errors
    }

    return {
      data: {
        companyName: sieFile.companyName,
        accountsImported: newAccounts.length,
        vouchersImported: importedCount,
        vouchersWithErrors: errorCount,
      },
    };
  });
}
