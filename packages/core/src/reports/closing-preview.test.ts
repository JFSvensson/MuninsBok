import { describe, it, expect } from "vitest";
import { calculateClosingPreview } from "./closing-preview.js";
import type { Account } from "../types/account.js";
import type { Voucher } from "../types/voucher.js";
import type { VoucherLine } from "../types/voucher-line.js";

// ── Helpers ─────────────────────────────────────────────────

function line(id: string, accountNumber: string, debit: number, credit: number): VoucherLine {
  return { id, voucherId: "v", accountNumber, debit, credit };
}

function voucher(date: string, lines: VoucherLine[]): Voucher {
  return {
    id: `v-${date}`,
    organizationId: "org",
    fiscalYearId: "fy",
    number: 1,
    date: new Date(date),
    description: "Test",
    lines,
    documentIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const accounts: Account[] = [
  { number: "1930", name: "Bank", type: "ASSET", isVatAccount: false, isActive: true },
  { number: "2099", name: "Årets resultat", type: "EQUITY", isVatAccount: false, isActive: true },
  { number: "3000", name: "Försäljning", type: "REVENUE", isVatAccount: false, isActive: true },
  { number: "3010", name: "Tjänsteintäkter", type: "REVENUE", isVatAccount: false, isActive: true },
  { number: "5010", name: "Lokalkostnad", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "6200", name: "Telefon", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "8310", name: "Ränteintäkter", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "8400", name: "Räntekostnader", type: "EXPENSE", isVatAccount: false, isActive: true },
];

// ── Tests ───────────────────────────────────────────────────

describe("calculateClosingPreview", () => {
  it("returns empty preview for no vouchers", () => {
    const preview = calculateClosingPreview([], accounts);

    expect(preview.hasEntries).toBe(false);
    expect(preview.accountCount).toBe(0);
    expect(preview.netResult).toBe(0);
    expect(preview.revenues.lines).toHaveLength(0);
    expect(preview.expenses.lines).toHaveLength(0);
    expect(preview.isBalanced).toBe(true);
    expect(preview.resultEntry.debit).toBe(0);
    expect(preview.resultEntry.credit).toBe(0);
  });

  it("calculates revenue closing entries correctly", () => {
    const vouchers = [
      voucher("2024-03-01", [
        line("l1", "1930", 100000, 0),
        line("l2", "3000", 0, 100000), // Revenue: credit
      ]),
    ];

    const preview = calculateClosingPreview(vouchers, accounts);

    expect(preview.revenues.lines).toHaveLength(1);
    const revLine = preview.revenues.lines[0]!;
    expect(revLine.accountNumber).toBe("3000");
    expect(revLine.accountName).toBe("Försäljning");
    expect(revLine.currentBalance).toBe(100000); // credit - debit = 100000
    // Closing reverses: positive balance → debit
    expect(revLine.closingDebit).toBe(100000);
    expect(revLine.closingCredit).toBe(0);
  });

  it("calculates expense closing entries correctly", () => {
    const vouchers = [
      voucher("2024-04-01", [
        line("l1", "5010", 50000, 0), // Expense: debit
        line("l2", "1930", 0, 50000),
      ]),
    ];

    const preview = calculateClosingPreview(vouchers, accounts);

    expect(preview.expenses.lines).toHaveLength(1);
    const expLine = preview.expenses.lines[0]!;
    expect(expLine.accountNumber).toBe("5010");
    expect(expLine.currentBalance).toBe(-50000); // credit - debit = -50000
    // Closing reverses: negative balance → credit
    expect(expLine.closingDebit).toBe(0);
    expect(expLine.closingCredit).toBe(50000);
  });

  it("books profit to 2099 as credit", () => {
    const vouchers = [
      voucher("2024-03-01", [
        line("l1", "1930", 100000, 0),
        line("l2", "3000", 0, 100000), // Revenue 1000 kr
      ]),
      voucher("2024-04-01", [
        line("l3", "5010", 30000, 0), // Expense 300 kr
        line("l4", "1930", 0, 30000),
      ]),
    ];

    const preview = calculateClosingPreview(vouchers, accounts);

    // Net result = 100000 (revenue) + (-30000) (expense) = 70000 = profit
    expect(preview.netResult).toBe(70000);
    expect(preview.resultEntry.accountNumber).toBe("2099");
    expect(preview.resultEntry.credit).toBe(70000);
    expect(preview.resultEntry.debit).toBe(0);
  });

  it("books loss to 2099 as debit", () => {
    const vouchers = [
      voucher("2024-03-01", [
        line("l1", "1930", 20000, 0),
        line("l2", "3000", 0, 20000), // Revenue 200 kr
      ]),
      voucher("2024-04-01", [
        line("l3", "5010", 80000, 0), // Expense 800 kr
        line("l4", "1930", 0, 80000),
      ]),
    ];

    const preview = calculateClosingPreview(vouchers, accounts);

    // Net result = 20000 + (-80000) = -60000 = loss
    expect(preview.netResult).toBe(-60000);
    expect(preview.resultEntry.debit).toBe(60000);
    expect(preview.resultEntry.credit).toBe(0);
  });

  it("closing voucher always balances", () => {
    const vouchers = [
      voucher("2024-01-15", [
        line("l1", "1930", 100000, 0),
        line("l2", "3000", 0, 70000),
        line("l3", "3010", 0, 30000),
      ]),
      voucher("2024-02-10", [
        line("l4", "5010", 25000, 0),
        line("l5", "6200", 15000, 0),
        line("l6", "1930", 0, 40000),
      ]),
      voucher("2024-06-01", [
        line("l7", "1930", 5000, 0),
        line("l8", "8310", 0, 5000), // Financial income
      ]),
      voucher("2024-07-01", [
        line("l9", "8400", 3000, 0), // Financial expense
        line("l10", "1930", 0, 3000),
      ]),
    ];

    const preview = calculateClosingPreview(vouchers, accounts);

    expect(preview.isBalanced).toBe(true);
    expect(preview.hasEntries).toBe(true);
    // 3000, 3010, 5010, 6200, 8310, 8400 — all non-zero → 6 accounts
    expect(preview.accountCount).toBe(6);
  });

  it("classifies financial income and expense sections correctly", () => {
    const vouchers = [
      voucher("2024-06-01", [
        line("l1", "1930", 5000, 0),
        line("l2", "8310", 0, 5000), // Financial income (8000-8399)
      ]),
      voucher("2024-07-01", [
        line("l3", "8400", 3000, 0), // Financial expense (8400-8999)
        line("l4", "1930", 0, 3000),
      ]),
    ];

    const preview = calculateClosingPreview(vouchers, accounts);

    expect(preview.financialIncome.lines).toHaveLength(1);
    expect(preview.financialIncome.lines[0]!.accountNumber).toBe("8310");
    expect(preview.financialIncome.total).toBe(5000);

    expect(preview.financialExpenses.lines).toHaveLength(1);
    expect(preview.financialExpenses.lines[0]!.accountNumber).toBe("8400");
    expect(preview.financialExpenses.total).toBe(-3000);

    expect(preview.totalFinancialIncome).toBe(5000);
    expect(preview.totalFinancialExpenses).toBe(3000);
  });

  it("ignores balance sheet accounts (1xxx, 2xxx)", () => {
    const vouchers = [
      voucher("2024-01-01", [
        line("l1", "1930", 50000, 0),
        line("l2", "2440", 0, 50000), // Liability — should be ignored
      ]),
    ];

    const preview = calculateClosingPreview(vouchers, accounts);

    expect(preview.hasEntries).toBe(false);
    expect(preview.accountCount).toBe(0);
    expect(preview.netResult).toBe(0);
  });

  it("skips accounts with zero balance", () => {
    const vouchers = [
      voucher("2024-03-01", [line("l1", "3000", 0, 10000), line("l2", "1930", 10000, 0)]),
      voucher("2024-03-15", [
        line("l3", "3000", 10000, 0), // Reversal — zeroes out 3000
        line("l4", "1930", 0, 10000),
      ]),
    ];

    const preview = calculateClosingPreview(vouchers, accounts);

    expect(preview.revenues.lines).toHaveLength(0);
    expect(preview.accountCount).toBe(0);
    expect(preview.hasEntries).toBe(false);
  });

  it("provides correct operating result", () => {
    const vouchers = [
      voucher("2024-03-01", [line("l1", "1930", 100000, 0), line("l2", "3000", 0, 100000)]),
      voucher("2024-04-01", [line("l3", "5010", 40000, 0), line("l4", "1930", 0, 40000)]),
      voucher("2024-06-01", [
        line("l5", "1930", 10000, 0),
        line("l6", "8310", 0, 10000), // Financial income
      ]),
    ];

    const preview = calculateClosingPreview(vouchers, accounts);

    // Operating: 100000 revenue, -40000 expense → operatingResult
    expect(preview.operatingResult).toBe(60000); // revenues.total + expenses.total
    expect(preview.totalRevenues).toBe(100000);
    expect(preview.totalExpenses).toBe(40000); // Inverted sign for display
    expect(preview.totalFinancialIncome).toBe(10000);
    expect(preview.netResult).toBe(70000); // 100000 - 40000 + 10000
  });

  it("lines are sorted by account number", () => {
    const vouchers = [
      voucher("2024-03-01", [
        line("l1", "3010", 0, 30000),
        line("l2", "3000", 0, 70000),
        line("l3", "1930", 100000, 0),
      ]),
    ];

    const preview = calculateClosingPreview(vouchers, accounts);

    expect(preview.revenues.lines).toHaveLength(2);
    expect(preview.revenues.lines[0]!.accountNumber).toBe("3000");
    expect(preview.revenues.lines[1]!.accountNumber).toBe("3010");
  });

  it("handles unknown account (not in accounts list)", () => {
    const vouchers = [
      voucher("2024-03-01", [
        line("l1", "1930", 50000, 0),
        line("l2", "3999", 0, 50000), // Not in accounts list
      ]),
    ];

    const preview = calculateClosingPreview(vouchers, accounts);

    expect(preview.revenues.lines).toHaveLength(1);
    expect(preview.revenues.lines[0]!.accountName).toBe("Okänt konto");
  });

  it("result entry has zero amounts when P&L sums to zero", () => {
    const vouchers = [
      voucher("2024-03-01", [line("l1", "1930", 50000, 0), line("l2", "3000", 0, 50000)]),
      voucher("2024-04-01", [line("l3", "5010", 50000, 0), line("l4", "1930", 0, 50000)]),
    ];

    const preview = calculateClosingPreview(vouchers, accounts);

    expect(preview.netResult).toBe(0);
    expect(preview.resultEntry.debit).toBe(0);
    expect(preview.resultEntry.credit).toBe(0);
    expect(preview.isBalanced).toBe(true);
  });

  it("generatedAt is set", () => {
    const before = new Date();
    const preview = calculateClosingPreview([], accounts);
    expect(preview.generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});
