import type { FastifyInstance, FastifyReply } from "fastify";
import type { Voucher, Account } from "@muninsbok/core/types";
import {
  calculateTrialBalance,
  calculateIncomeStatement,
  calculateBalanceSheet,
  calculateVatReport,
  calculateSkVatDeclaration,
  generateJournal,
  generateGeneralLedger,
  generateVoucherListReport,
} from "@muninsbok/core/reports";
import {
  öreToKronor,
  convertDebitCredit,
  convertAmountSection,
  convertBalanceSection,
} from "../utils/amount-conversion.js";

// ── helpers ─────────────────────────────────────────────────

/** Filter vouchers by optional date range */
function filterByDateRange(vouchers: Voucher[], startDate?: string, endDate?: string): Voucher[] {
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
          debit: öreToKronor(row.debit),
          credit: öreToKronor(row.credit),
          balance: öreToKronor(row.balance),
        })),
        totalDebit: öreToKronor(report.totalDebit),
        totalCredit: öreToKronor(report.totalCredit),
      },
    };
  });

  // Income Statement (Resultaträkning)
  fastify.get<ReportParams>("/:orgId/reports/income-statement", async (request, reply) => {
    const ctx = await loadReportData(fastify, request.params.orgId, request.query, reply);
    if (!ctx) return;

    const report = calculateIncomeStatement(ctx.vouchers, ctx.accounts);

    return {
      data: {
        revenues: convertAmountSection(report.revenues),
        expenses: convertAmountSection(report.expenses),
        operatingResult: öreToKronor(report.operatingResult),
        financialIncome: convertAmountSection(report.financialIncome),
        financialExpenses: convertAmountSection(report.financialExpenses),
        netResult: öreToKronor(report.netResult),
        generatedAt: report.generatedAt,
      },
    };
  });

  // Balance Sheet (Balansräkning)
  fastify.get<ReportParams>("/:orgId/reports/balance-sheet", async (request, reply) => {
    const ctx = await loadReportData(fastify, request.params.orgId, request.query, reply);
    if (!ctx) return;

    const report = calculateBalanceSheet(ctx.vouchers, ctx.accounts);

    return {
      data: {
        assets: convertBalanceSection(report.assets),
        liabilities: convertBalanceSection(report.liabilities),
        equity: convertBalanceSection(report.equity),
        totalAssets: öreToKronor(report.totalAssets),
        totalLiabilitiesAndEquity: öreToKronor(report.totalLiabilitiesAndEquity),
        difference: öreToKronor(report.difference),
        yearResult: öreToKronor(report.yearResult),
        generatedAt: report.generatedAt,
      },
    };
  });

  // VAT Report (Momsrapport)
  fastify.get<ReportParams>("/:orgId/reports/vat", async (request, reply) => {
    const ctx = await loadReportData(fastify, request.params.orgId, request.query, reply);
    if (!ctx) return;

    const report = calculateVatReport(ctx.vouchers, ctx.accounts);

    return {
      data: {
        outputVat: report.outputVat.map((row) => ({ ...row, amount: öreToKronor(row.amount) })),
        totalOutputVat: öreToKronor(report.totalOutputVat),
        inputVat: report.inputVat.map((row) => ({ ...row, amount: öreToKronor(row.amount) })),
        totalInputVat: öreToKronor(report.totalInputVat),
        vatPayable: öreToKronor(report.vatPayable),
        generatedAt: report.generatedAt,
      },
    };
  });

  // SKV Momsdeklaration (Skattedeklaration moms, blankett SKV 4700)
  fastify.get<ReportParams>("/:orgId/reports/vat-declaration", async (request, reply) => {
    const ctx = await loadReportData(fastify, request.params.orgId, request.query, reply);
    if (!ctx) return;

    const decl = calculateSkVatDeclaration(ctx.vouchers, ctx.accounts);

    // SKV declarations use whole kronor (rounded)
    const toWholeKronor = (öre: number) => Math.round(öre / 100);

    return {
      data: {
        ruta05: toWholeKronor(decl.ruta05),
        ruta06: toWholeKronor(decl.ruta06),
        ruta07: toWholeKronor(decl.ruta07),
        ruta08: toWholeKronor(decl.ruta08),
        ruta10: toWholeKronor(decl.ruta10),
        ruta11: toWholeKronor(decl.ruta11),
        ruta12: toWholeKronor(decl.ruta12),
        ruta20: toWholeKronor(decl.ruta20),
        ruta21: toWholeKronor(decl.ruta21),
        ruta22: toWholeKronor(decl.ruta22),
        ruta23: toWholeKronor(decl.ruta23),
        ruta24: toWholeKronor(decl.ruta24),
        ruta30: toWholeKronor(decl.ruta30),
        ruta31: toWholeKronor(decl.ruta31),
        ruta32: toWholeKronor(decl.ruta32),
        ruta33: toWholeKronor(decl.ruta33),
        ruta35: toWholeKronor(decl.ruta35),
        ruta36: toWholeKronor(decl.ruta36),
        ruta37: toWholeKronor(decl.ruta37),
        ruta38: toWholeKronor(decl.ruta38),
        ruta39: toWholeKronor(decl.ruta39),
        ruta40: toWholeKronor(decl.ruta40),
        ruta41: toWholeKronor(decl.ruta41),
        ruta42: toWholeKronor(decl.ruta42),
        ruta48: toWholeKronor(decl.ruta48),
        ruta49: toWholeKronor(decl.ruta49),
        ruta50: toWholeKronor(decl.ruta50),
        boxes: decl.boxes.map((b) => ({
          box: b.box,
          label: b.label,
          amount: toWholeKronor(b.amount),
        })),
        generatedAt: decl.generatedAt,
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
          lines: entry.lines.map(convertDebitCredit),
          totalDebit: öreToKronor(entry.totalDebit),
          totalCredit: öreToKronor(entry.totalCredit),
        })),
        totalDebit: öreToKronor(report.totalDebit),
        totalCredit: öreToKronor(report.totalCredit),
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
            ...convertDebitCredit(txn),
            balance: öreToKronor(txn.balance),
          })),
          totalDebit: öreToKronor(account.totalDebit),
          totalCredit: öreToKronor(account.totalCredit),
          closingBalance: öreToKronor(account.closingBalance),
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
          lines: entry.lines.map(convertDebitCredit),
          totalDebit: öreToKronor(entry.totalDebit),
          totalCredit: öreToKronor(entry.totalCredit),
        })),
        totalDebit: öreToKronor(report.totalDebit),
        totalCredit: öreToKronor(report.totalCredit),
        count: report.count,
        generatedAt: report.generatedAt,
      },
    };
  });
}
