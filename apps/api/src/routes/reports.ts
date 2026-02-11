import type { FastifyInstance } from "fastify";
import { prisma, VoucherRepository, AccountRepository } from "@muninsbok/db";
import {
  calculateTrialBalance,
  calculateIncomeStatement,
  calculateBalanceSheet,
} from "@muninsbok/core";

export async function reportRoutes(fastify: FastifyInstance) {
  const voucherRepo = new VoucherRepository(prisma);
  const accountRepo = new AccountRepository(prisma);

  // Trial Balance (Råbalans)
  fastify.get<{
    Params: { orgId: string };
    Querystring: { fiscalYearId: string };
  }>("/:orgId/reports/trial-balance", async (request, reply) => {
    const { orgId } = request.params;
    const { fiscalYearId } = request.query;

    if (!fiscalYearId) {
      return reply.status(400).send({ error: "fiscalYearId is required" });
    }

    const [vouchers, accounts] = await Promise.all([
      voucherRepo.findByFiscalYear(fiscalYearId, orgId),
      accountRepo.findByOrganization(orgId),
    ]);

    const report = calculateTrialBalance(vouchers, accounts);

    return {
      data: {
        ...report,
        // Convert ören to kronor for API response
        rows: report.rows.map((row) => ({
          ...row,
          debit: row.debit / 100,
          credit: row.credit / 100,
          balance: row.balance / 100,
        })),
        totalDebit: report.totalDebit / 100,
        totalCredit: report.totalCredit / 100,
      },
    };
  });

  // Income Statement (Resultaträkning)
  fastify.get<{
    Params: { orgId: string };
    Querystring: { fiscalYearId: string };
  }>("/:orgId/reports/income-statement", async (request, reply) => {
    const { orgId } = request.params;
    const { fiscalYearId } = request.query;

    if (!fiscalYearId) {
      return reply.status(400).send({ error: "fiscalYearId is required" });
    }

    const [vouchers, accounts] = await Promise.all([
      voucherRepo.findByFiscalYear(fiscalYearId, orgId),
      accountRepo.findByOrganization(orgId),
    ]);

    const report = calculateIncomeStatement(vouchers, accounts);

    // Convert ören to kronor
    const convertSection = (section: typeof report.revenues) => ({
      ...section,
      rows: section.rows.map((row) => ({
        ...row,
        amount: row.amount / 100,
      })),
      total: section.total / 100,
    });

    return {
      data: {
        revenues: convertSection(report.revenues),
        expenses: convertSection(report.expenses),
        operatingResult: report.operatingResult / 100,
        financialIncome: convertSection(report.financialIncome),
        financialExpenses: convertSection(report.financialExpenses),
        netResult: report.netResult / 100,
        generatedAt: report.generatedAt,
      },
    };
  });

  // Balance Sheet (Balansräkning)
  fastify.get<{
    Params: { orgId: string };
    Querystring: { fiscalYearId: string };
  }>("/:orgId/reports/balance-sheet", async (request, reply) => {
    const { orgId } = request.params;
    const { fiscalYearId } = request.query;

    if (!fiscalYearId) {
      return reply.status(400).send({ error: "fiscalYearId is required" });
    }

    const [vouchers, accounts] = await Promise.all([
      voucherRepo.findByFiscalYear(fiscalYearId, orgId),
      accountRepo.findByOrganization(orgId),
    ]);

    const report = calculateBalanceSheet(vouchers, accounts);

    // Convert ören to kronor
    const convertSection = (section: typeof report.assets) => ({
      ...section,
      rows: section.rows.map((row) => ({
        ...row,
        balance: row.balance / 100,
      })),
      total: section.total / 100,
    });

    return {
      data: {
        assets: convertSection(report.assets),
        liabilities: convertSection(report.liabilities),
        equity: convertSection(report.equity),
        totalAssets: report.totalAssets / 100,
        totalLiabilitiesAndEquity: report.totalLiabilitiesAndEquity / 100,
        difference: report.difference / 100,
        yearResult: report.yearResult / 100,
        generatedAt: report.generatedAt,
      },
    };
  });
}
