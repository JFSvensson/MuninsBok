import type { FastifyInstance } from "fastify";
import {
  calculateTrialBalance,
  calculateIncomeStatement,
  calculateBalanceSheet,
  calculateVatReport,
  generateJournal,
  generateGeneralLedger,
  generateVoucherListReport,
} from "@muninsbok/core";

export async function reportRoutes(fastify: FastifyInstance) {
  const voucherRepo = fastify.repos.vouchers;
  const accountRepo = fastify.repos.accounts;

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
  fastify.get<{
    Params: { orgId: string };
    Querystring: { fiscalYearId: string };
  }>("/:orgId/reports/vat", async (request, reply) => {
    const { orgId } = request.params;
    const { fiscalYearId } = request.query;

    if (!fiscalYearId) {
      return reply.status(400).send({ error: "fiscalYearId is required" });
    }

    const [vouchers, accounts] = await Promise.all([
      voucherRepo.findByFiscalYear(fiscalYearId, orgId),
      accountRepo.findByOrganization(orgId),
    ]);

    const report = calculateVatReport(vouchers, accounts);

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
  fastify.get<{
    Params: { orgId: string };
    Querystring: { fiscalYearId: string };
  }>("/:orgId/reports/journal", async (request, reply) => {
    const { orgId } = request.params;
    const { fiscalYearId } = request.query;

    if (!fiscalYearId) {
      return reply.status(400).send({ error: "fiscalYearId is required" });
    }

    const [vouchers, accounts] = await Promise.all([
      voucherRepo.findByFiscalYear(fiscalYearId, orgId),
      accountRepo.findByOrganization(orgId),
    ]);

    const report = generateJournal(vouchers, accounts);

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
  fastify.get<{
    Params: { orgId: string };
    Querystring: { fiscalYearId: string };
  }>("/:orgId/reports/general-ledger", async (request, reply) => {
    const { orgId } = request.params;
    const { fiscalYearId } = request.query;

    if (!fiscalYearId) {
      return reply.status(400).send({ error: "fiscalYearId is required" });
    }

    const [vouchers, accounts] = await Promise.all([
      voucherRepo.findByFiscalYear(fiscalYearId, orgId),
      accountRepo.findByOrganization(orgId),
    ]);

    const report = generateGeneralLedger(vouchers, accounts);

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
  fastify.get<{
    Params: { orgId: string };
    Querystring: { fiscalYearId: string };
  }>("/:orgId/reports/voucher-list", async (request, reply) => {
    const { orgId } = request.params;
    const { fiscalYearId } = request.query;

    if (!fiscalYearId) {
      return reply.status(400).send({ error: "fiscalYearId is required" });
    }

    const [vouchers, accounts] = await Promise.all([
      voucherRepo.findByFiscalYear(fiscalYearId, orgId),
      accountRepo.findByOrganization(orgId),
    ]);

    const report = generateVoucherListReport(vouchers, accounts);

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
