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
      return reply.status(400).send({ error: "fiscalYearId krävs" });
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

    // Monthly aggregation for trend chart
    const monthlyMap = new Map<string, { count: number; income: number; expense: number }>();
    for (const voucher of vouchers) {
      const key = `${voucher.date.getFullYear()}-${String(voucher.date.getMonth() + 1).padStart(2, "0")}`;
      let entry = monthlyMap.get(key);
      if (!entry) {
        entry = { count: 0, income: 0, expense: 0 };
        monthlyMap.set(key, entry);
      }
      entry.count += 1;
      for (const line of voucher.lines) {
        // Revenue accounts start with 3
        const acct = accounts.find((a) => a.number === line.accountNumber);
        if (acct?.type === "REVENUE") {
          entry.income += line.credit - line.debit;
        } else if (acct?.type === "EXPENSE") {
          entry.expense += line.debit - line.credit;
        }
      }
    }

    const monthlyTrend = [...monthlyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        voucherCount: data.count,
        income: data.income / 100,
        expense: data.expense / 100,
      }));

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
        monthlyTrend,
        generatedAt: new Date().toISOString(),
      },
    };
  });
}
