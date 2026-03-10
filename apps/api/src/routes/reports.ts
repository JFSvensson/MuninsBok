import type { FastifyInstance } from "fastify";
import type { Voucher, Account } from "@muninsbok/core/types";
import {
  calculateTrialBalance,
  calculateIncomeStatement,
  calculateBalanceSheet,
  calculateVatReport,
  calculateSkVatDeclaration,
  calculatePeriodReport,
  generateJournal,
  generateGeneralLedger,
  generateVoucherListReport,
} from "@muninsbok/core/reports";
import type { PeriodType } from "@muninsbok/core/reports";
import {
  öreToKronor,
  convertDebitCredit,
  convertAmountSection,
  convertBalanceSection,
} from "../utils/amount-conversion.js";
import { loadReportData, filterByDateRange } from "../utils/report-helpers.js";

// ── route type shorthands ───────────────────────────────────

type ReportParams = {
  Params: { orgId: string };
  Querystring: { fiscalYearId: string; startDate?: string; endDate?: string };
};

// ── routes ──────────────────────────────────────────────────

export async function reportRoutes(fastify: FastifyInstance) {
  /**
   * Register a standard report route that follows the common pattern:
   *   1. Load & filter vouchers + accounts
   *   2. Calculate report from domain logic
   *   3. Convert öre → kronor and return response
   */
  function registerReport<TRaw>(
    path: string,
    calculate: (vouchers: Voucher[], accounts: Account[]) => TRaw,
    convert: (report: TRaw) => unknown,
  ) {
    fastify.get<ReportParams>(`/:orgId/reports/${path}`, async (request, reply) => {
      const ctx = await loadReportData(fastify, request.params.orgId, request.query, reply);
      if (!ctx) return;
      return { data: convert(calculate(ctx.vouchers, ctx.accounts)) };
    });
  }

  // Trial Balance (Råbalans)
  registerReport("trial-balance", calculateTrialBalance, (report) => ({
    ...report,
    rows: report.rows.map((row) => ({
      ...row,
      debit: öreToKronor(row.debit),
      credit: öreToKronor(row.credit),
      balance: öreToKronor(row.balance),
    })),
    totalDebit: öreToKronor(report.totalDebit),
    totalCredit: öreToKronor(report.totalCredit),
  }));

  // Income Statement (Resultaträkning)
  registerReport("income-statement", calculateIncomeStatement, (report) => ({
    revenues: convertAmountSection(report.revenues),
    expenses: convertAmountSection(report.expenses),
    operatingResult: öreToKronor(report.operatingResult),
    financialIncome: convertAmountSection(report.financialIncome),
    financialExpenses: convertAmountSection(report.financialExpenses),
    netResult: öreToKronor(report.netResult),
    generatedAt: report.generatedAt,
  }));

  // Balance Sheet (Balansräkning)
  registerReport("balance-sheet", calculateBalanceSheet, (report) => ({
    assets: convertBalanceSection(report.assets),
    liabilities: convertBalanceSection(report.liabilities),
    equity: convertBalanceSection(report.equity),
    totalAssets: öreToKronor(report.totalAssets),
    totalLiabilitiesAndEquity: öreToKronor(report.totalLiabilitiesAndEquity),
    difference: öreToKronor(report.difference),
    yearResult: öreToKronor(report.yearResult),
    generatedAt: report.generatedAt,
  }));

  // VAT Report (Momsrapport)
  registerReport("vat", calculateVatReport, (report) => ({
    outputVat: report.outputVat.map((row) => ({ ...row, amount: öreToKronor(row.amount) })),
    totalOutputVat: öreToKronor(report.totalOutputVat),
    inputVat: report.inputVat.map((row) => ({ ...row, amount: öreToKronor(row.amount) })),
    totalInputVat: öreToKronor(report.totalInputVat),
    vatPayable: öreToKronor(report.vatPayable),
    generatedAt: report.generatedAt,
  }));

  // SKV Momsdeklaration (Skattedeklaration moms, blankett SKV 4700)
  registerReport("vat-declaration", calculateSkVatDeclaration, (decl) => {
    const toWholeKronor = (öre: number) => Math.round(öre / 100);
    return {
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
    };
  });

  // Journal (Grundbok)
  registerReport("journal", generateJournal, (report) => ({
    entries: report.entries.map((entry) => ({
      ...entry,
      lines: entry.lines.map(convertDebitCredit),
      totalDebit: öreToKronor(entry.totalDebit),
      totalCredit: öreToKronor(entry.totalCredit),
    })),
    totalDebit: öreToKronor(report.totalDebit),
    totalCredit: öreToKronor(report.totalCredit),
    generatedAt: report.generatedAt,
  }));

  // General Ledger (Huvudbok)
  registerReport("general-ledger", generateGeneralLedger, (report) => ({
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
  }));

  // Voucher List Report (Verifikationslista)
  registerReport("voucher-list", generateVoucherListReport, (report) => ({
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
  }));

  // Period Report (Periodrapport – månads-/kvartalssammanställning)
  fastify.get<{
    Params: { orgId: string };
    Querystring: {
      fiscalYearId: string;
      startDate?: string;
      endDate?: string;
      periodType?: string;
    };
  }>("/:orgId/reports/period", async (request, reply) => {
    const ctx = await loadReportData(fastify, request.params.orgId, request.query, reply);
    if (!ctx) return;

    const raw = request.query.periodType ?? "month";
    if (raw !== "month" && raw !== "quarter") {
      return reply.status(400).send({ error: "periodType måste vara 'month' eller 'quarter'" });
    }
    const periodType: PeriodType = raw;

    const report = calculatePeriodReport(ctx.vouchers, ctx.accounts, periodType);

    return {
      data: {
        periodType: report.periodType,
        periods: report.periods.map((p) => ({
          label: p.label,
          startDate: p.startDate,
          endDate: p.endDate,
          income: öreToKronor(p.income),
          expenses: öreToKronor(p.expenses),
          result: öreToKronor(p.result),
          cumulativeResult: öreToKronor(p.cumulativeResult),
        })),
        totalIncome: öreToKronor(report.totalIncome),
        totalExpenses: öreToKronor(report.totalExpenses),
        totalResult: öreToKronor(report.totalResult),
        generatedAt: report.generatedAt,
      },
    };
  });

  // Account Analysis (Kontoanalys)
  fastify.get<{
    Params: { orgId: string };
    Querystring: {
      fiscalYearId: string;
      accountNumber: string;
      startDate?: string;
      endDate?: string;
    };
  }>("/:orgId/reports/account-analysis", async (request, reply) => {
    const { fiscalYearId, accountNumber, startDate, endDate } = request.query;

    if (!fiscalYearId) {
      return reply.status(400).send({ error: "fiscalYearId krävs" });
    }
    if (!accountNumber) {
      return reply.status(400).send({ error: "accountNumber krävs" });
    }

    const [allVouchers, accounts] = await Promise.all([
      fastify.repos.vouchers.findByFiscalYear(fiscalYearId, request.params.orgId),
      fastify.repos.accounts.findByOrganization(request.params.orgId),
    ]);

    const account = accounts.find((a) => a.number === accountNumber);
    if (!account) {
      return reply.status(404).send({ error: "Kontot hittades inte" });
    }

    const vouchers = filterByDateRange(allVouchers, startDate, endDate);

    // Group transactions by month
    const monthMap = new Map<string, { debit: number; credit: number; count: number }>();

    for (const voucher of vouchers) {
      for (const line of voucher.lines) {
        if (line.accountNumber !== accountNumber) continue;

        const d = voucher.date instanceof Date ? voucher.date : new Date(voucher.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

        const entry = monthMap.get(key) ?? { debit: 0, credit: 0, count: 0 };
        entry.debit += line.debit;
        entry.credit += line.credit;
        entry.count += 1;
        monthMap.set(key, entry);
      }
    }

    // Sort months and compute running balance
    const sortedKeys = [...monthMap.keys()].sort();
    let runningBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    let totalTransactions = 0;

    const months = sortedKeys
      .map((key) => {
        const entry = monthMap.get(key);
        if (!entry) return null;
        const net = entry.debit - entry.credit;
        runningBalance += net;
        totalDebit += entry.debit;
        totalCredit += entry.credit;
        totalTransactions += entry.count;

        const [year, month] = key.split("-") as [string, string];
        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "Maj",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Okt",
          "Nov",
          "Dec",
        ];
        const label = `${monthNames[parseInt(month, 10) - 1]} ${year}`;

        return {
          month: key,
          label,
          debit: öreToKronor(entry.debit),
          credit: öreToKronor(entry.credit),
          net: öreToKronor(net),
          balance: öreToKronor(runningBalance),
          transactionCount: entry.count,
        };
      })
      .filter((m) => m !== null);

    // Compute stats
    const nets = months.map((m) => m.net);
    const highIdx = nets.length > 0 ? nets.indexOf(Math.max(...nets)) : -1;
    const lowIdx = nets.length > 0 ? nets.indexOf(Math.min(...nets)) : -1;
    const avgNet = months.length > 0 ? nets.reduce((a, b) => a + b, 0) / months.length : 0;

    const highEntry = highIdx >= 0 ? months[highIdx] : undefined;
    const lowEntry = lowIdx >= 0 ? months[lowIdx] : undefined;

    return {
      data: {
        accountNumber,
        accountName: account.name,
        totalDebit: öreToKronor(totalDebit),
        totalCredit: öreToKronor(totalCredit),
        closingBalance: öreToKronor(runningBalance),
        months,
        totalTransactions,
        averageMonthlyNet: Math.round(avgNet * 100) / 100,
        highestMonthlyNet: highEntry?.net ?? 0,
        highestMonthLabel: highEntry?.label ?? "–",
        lowestMonthlyNet: lowEntry?.net ?? 0,
        lowestMonthLabel: lowEntry?.label ?? "–",
        generatedAt: new Date().toISOString(),
      },
    };
  });
}
