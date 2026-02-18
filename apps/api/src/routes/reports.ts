import type { FastifyInstance, FastifyReply } from "fastify";
import type { Voucher, Account } from "@muninsbok/core";
import {
  calculateTrialBalance,
  calculateIncomeStatement,
  calculateBalanceSheet,
  calculateVatReport,
  generateJournal,
  generateGeneralLedger,
  generateVoucherListReport,
} from "@muninsbok/core";

// ── helpers ─────────────────────────────────────────────────

/** Filter vouchers by optional date range */
function filterByDateRange(
  vouchers: Voucher[],
  startDate?: string,
  endDate?: string,
): Voucher[] {
  if (!startDate && !endDate) return vouchers;
  return vouchers.filter((v) => {
    const d = v.date instanceof Date ? v.date : new Date(v.date);
    if (startDate && d < new Date(startDate)) return false;
    if (endDate && d > new Date(endDate)) return false;
    return true;
  });
}

interface ReportRouteContext {
  vouchers: Voucher[];
  accounts: Account[];
}

/**
 * Common plumbing shared by every report endpoint:
 *   1. Validate that fiscalYearId was provided
 *   2. Fetch vouchers + accounts in parallel
 *   3. Apply optional date range filter
 *
 * Returns the filtered vouchers + accounts, or sends a 400
 * and returns `null` so the caller can short-circuit.
 */
async function loadReportData(
  fastify: FastifyInstance,
  orgId: string,
  query: { fiscalYearId?: string; startDate?: string; endDate?: string },
  reply: FastifyReply,
): Promise<ReportRouteContext | null> {
  const { fiscalYearId, startDate, endDate } = query;

  if (!fiscalYearId) {
    reply.status(400).send({ error: "fiscalYearId krävs" });
    return null;
  }

  const [allVouchers, accounts] = await Promise.all([
    fastify.repos.vouchers.findByFiscalYear(fiscalYearId, orgId),
    fastify.repos.accounts.findByOrganization(orgId),
  ]);

  const vouchers = filterByDateRange(allVouchers, startDate, endDate);
  return { vouchers, accounts };
}

// ── route type shorthand ────────────────────────────────────

type ReportParams = {
  Params: { orgId: string };
  Querystring: { fiscalYearId: string; startDate?: string; endDate?: string };
};

// ── routes ──────────────────────────────────────────────────

export async function reportRoutes(fastify: FastifyInstance) {
  // Trial Balance (Råbalans)
  fastify.get<ReportParams>("/:orgId/reports/trial-balance", async (request, reply) => {
    const ctx = await loadReportData(fastify, request.params.orgId, request.query, reply);
    if (!ctx) return;

    const report = calculateTrialBalance(ctx.vouchers, ctx.accounts);

    return {
      data: {
        ...report,
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
  fastify.get<ReportParams>("/:orgId/reports/income-statement", async (request, reply) => {
    const ctx = await loadReportData(fastify, request.params.orgId, request.query, reply);
    if (!ctx) return;

    const report = calculateIncomeStatement(ctx.vouchers, ctx.accounts);

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
  fastify.get<ReportParams>("/:orgId/reports/balance-sheet", async (request, reply) => {
    const ctx = await loadReportData(fastify, request.params.orgId, request.query, reply);
    if (!ctx) return;

    const report = calculateBalanceSheet(ctx.vouchers, ctx.accounts);

    const convertSection = (section: typeof report.assets) => ({
      ...section,
      rows: section.rows.map((row) => ({
        accountNumber: row.accountNumber,
        accountName: row.accountName,
        amount: row.balance / 100,
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

  // VAT Report (Momsrapport)
  fastify.get<ReportParams>("/:orgId/reports/vat", async (request, reply) => {
    const ctx = await loadReportData(fastify, request.params.orgId, request.query, reply);
    if (!ctx) return;

    const report = calculateVatReport(ctx.vouchers, ctx.accounts);

    const convertRows = (rows: typeof report.outputVat) =>
      rows.map((row) => ({
        ...row,
        amount: row.amount / 100,
      }));

    return {
      data: {
        outputVat: convertRows(report.outputVat),
        totalOutputVat: report.totalOutputVat / 100,
        inputVat: convertRows(report.inputVat),
        totalInputVat: report.totalInputVat / 100,
        vatPayable: report.vatPayable / 100,
        generatedAt: report.generatedAt,
      },
    };
  });

  // Journal (Grundbok)
  fastify.get<ReportParams>("/:orgId/reports/journal", async (request, reply) => {
    const ctx = await loadReportData(fastify, request.params.orgId, request.query, reply);
    if (!ctx) return;

    const report = generateJournal(ctx.vouchers, ctx.accounts);

    return {
      data: {
        entries: report.entries.map((entry) => ({
          ...entry,
          lines: entry.lines.map((line) => ({
            ...line,
            debit: line.debit / 100,
            credit: line.credit / 100,
          })),
          totalDebit: entry.totalDebit / 100,
          totalCredit: entry.totalCredit / 100,
        })),
        totalDebit: report.totalDebit / 100,
        totalCredit: report.totalCredit / 100,
        generatedAt: report.generatedAt,
      },
    };
  });

  // General Ledger (Huvudbok)
  fastify.get<ReportParams>("/:orgId/reports/general-ledger", async (request, reply) => {
    const ctx = await loadReportData(fastify, request.params.orgId, request.query, reply);
    if (!ctx) return;

    const report = generateGeneralLedger(ctx.vouchers, ctx.accounts);

    return {
      data: {
        accounts: report.accounts.map((account) => ({
          ...account,
          transactions: account.transactions.map((txn) => ({
            ...txn,
            debit: txn.debit / 100,
            credit: txn.credit / 100,
            balance: txn.balance / 100,
          })),
          totalDebit: account.totalDebit / 100,
          totalCredit: account.totalCredit / 100,
          closingBalance: account.closingBalance / 100,
        })),
        generatedAt: report.generatedAt,
      },
    };
  });

  // Voucher List Report (Verifikationslista)
  fastify.get<ReportParams>("/:orgId/reports/voucher-list", async (request, reply) => {
    const ctx = await loadReportData(fastify, request.params.orgId, request.query, reply);
    if (!ctx) return;

    const report = generateVoucherListReport(ctx.vouchers, ctx.accounts);

    return {
      data: {
        entries: report.entries.map((entry) => ({
          ...entry,
          lines: entry.lines.map((line) => ({
            ...line,
            debit: line.debit / 100,
            credit: line.credit / 100,
          })),
          totalDebit: entry.totalDebit / 100,
          totalCredit: entry.totalCredit / 100,
        })),
        totalDebit: report.totalDebit / 100,
        totalCredit: report.totalCredit / 100,
        count: report.count,
        generatedAt: report.generatedAt,
      },
    };
  });
}
