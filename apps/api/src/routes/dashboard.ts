import type { FastifyInstance } from "fastify";
import { calculateIncomeStatement } from "@muninsbok/core";

export async function dashboardRoutes(fastify: FastifyInstance) {
  const voucherRepo = fastify.repos.vouchers;
  const accountRepo = fastify.repos.accounts;

  fastify.get<{
    Params: { orgId: string };
    Querystring: { fiscalYearId: string };
  }>("/:orgId/dashboard", async (request, reply) => {
    const { orgId } = request.params;
    const { fiscalYearId } = request.query;

    if (!fiscalYearId) {
      return reply.status(400).send({ error: "fiscalYearId is required" });
    }

    const [vouchers, accounts] = await Promise.all([
      voucherRepo.findByFiscalYear(fiscalYearId, orgId),
      accountRepo.findByOrganization(orgId),
    ]);

    // Income statement for net result
    const incomeStatement = calculateIncomeStatement(vouchers, accounts);

    // Latest 5 vouchers (sorted by number desc)
    const latestVouchers = [...vouchers]
      .sort((a, b) => b.number - a.number)
      .slice(0, 5)
      .map((v) => ({
        id: v.id,
        number: v.number,
        date: v.date.toISOString(),
        description: v.description,
        amount: v.lines.reduce((sum, l) => sum + l.debit, 0) / 100,
      }));

    // Balance check — total debit should equal total credit
    let totalDebit = 0;
    let totalCredit = 0;
    for (const voucher of vouchers) {
      for (const line of voucher.lines) {
        totalDebit += line.debit;
        totalCredit += line.credit;
      }
    }

    // Account distribution
    const accountTypeCounts: Record<string, number> = {};
    for (const account of accounts) {
      accountTypeCounts[account.type] = (accountTypeCounts[account.type] ?? 0) + 1;
    }

    return {
      data: {
        voucherCount: vouchers.length,
        accountCount: accounts.length,
        netResult: incomeStatement.netResult / 100,
        totalDebit: totalDebit / 100,
        totalCredit: totalCredit / 100,
        isBalanced: totalDebit === totalCredit,
        latestVouchers,
        accountTypeCounts,
        generatedAt: new Date().toISOString(),
      },
    };
  });
}
