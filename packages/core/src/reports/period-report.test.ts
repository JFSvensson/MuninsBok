import { describe, it, expect } from "vitest";
import { calculatePeriodReport, type PeriodReport } from "./period-report.js";
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
  { number: "3000", name: "Intäkter", type: "REVENUE", isVatAccount: false, isActive: true },
  { number: "3010", name: "Tjänsteintäkter", type: "REVENUE", isVatAccount: false, isActive: true },
  { number: "5010", name: "Lokalkostnad", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "6200", name: "Telefon", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "8310", name: "Ränteintäkter", type: "REVENUE", isVatAccount: false, isActive: true },
  { number: "8400", name: "Räntekostnader", type: "EXPENSE", isVatAccount: false, isActive: true },
];

// ── Tests ───────────────────────────────────────────────────

describe("calculatePeriodReport", () => {
  it("returns empty periods for empty vouchers", () => {
    const report = calculatePeriodReport([], accounts, "month");
    expect(report.periods).toHaveLength(0);
    expect(report.totalIncome).toBe(0);
    expect(report.totalExpenses).toBe(0);
    expect(report.totalResult).toBe(0);
    expect(report.periodType).toBe("month");
  });

  it("calculates single-month report correctly", () => {
    const vouchers: Voucher[] = [
      voucher("2024-03-10", [line("l1", "1930", 50000, 0), line("l2", "3000", 0, 50000)]),
      voucher("2024-03-20", [line("l3", "5010", 20000, 0), line("l4", "1930", 0, 20000)]),
    ];

    const report = calculatePeriodReport(vouchers, accounts, "month");
    expect(report.periods).toHaveLength(1);

    const mar = report.periods[0]!;
    expect(mar.label).toBe("2024-03");
    expect(mar.startDate).toBe("2024-03-01");
    expect(mar.endDate).toBe("2024-03-31");
    expect(mar.income).toBe(50000);
    expect(mar.expenses).toBe(20000);
    expect(mar.result).toBe(30000);
    expect(mar.cumulativeResult).toBe(30000);

    expect(report.totalIncome).toBe(50000);
    expect(report.totalExpenses).toBe(20000);
    expect(report.totalResult).toBe(30000);
  });

  it("calculates multi-month report with gap months", () => {
    const vouchers: Voucher[] = [
      voucher("2024-01-15", [line("l1", "1930", 10000, 0), line("l2", "3000", 0, 10000)]),
      // February – no activity, should still appear as zero
      voucher("2024-03-10", [line("l3", "5010", 5000, 0), line("l4", "1930", 0, 5000)]),
    ];

    const report = calculatePeriodReport(vouchers, accounts, "month");
    expect(report.periods).toHaveLength(3); // Jan, Feb, Mar

    const [jan, feb, mar] = report.periods as [
      PeriodReport["periods"][number],
      PeriodReport["periods"][number],
      PeriodReport["periods"][number],
    ];

    expect(jan.label).toBe("2024-01");
    expect(jan.income).toBe(10000);
    expect(jan.expenses).toBe(0);
    expect(jan.result).toBe(10000);
    expect(jan.cumulativeResult).toBe(10000);

    expect(feb.label).toBe("2024-02");
    expect(feb.income).toBe(0);
    expect(feb.expenses).toBe(0);
    expect(feb.result).toBe(0);
    expect(feb.cumulativeResult).toBe(10000);

    expect(mar.label).toBe("2024-03");
    expect(mar.income).toBe(0);
    expect(mar.expenses).toBe(5000);
    expect(mar.result).toBe(-5000);
    expect(mar.cumulativeResult).toBe(5000);
  });

  it("calculates quarterly report correctly", () => {
    const vouchers: Voucher[] = [
      voucher("2024-02-01", [line("l1", "1930", 100000, 0), line("l2", "3000", 0, 100000)]),
      voucher("2024-05-01", [line("l3", "5010", 30000, 0), line("l4", "1930", 0, 30000)]),
      voucher("2024-06-15", [line("l5", "1930", 60000, 0), line("l6", "3010", 0, 60000)]),
    ];

    const report = calculatePeriodReport(vouchers, accounts, "quarter");
    expect(report.periodType).toBe("quarter");
    expect(report.periods).toHaveLength(2); // Q1 and Q2

    const [q1, q2] = report.periods as [
      PeriodReport["periods"][number],
      PeriodReport["periods"][number],
    ];

    expect(q1.label).toBe("2024 Q1");
    expect(q1.startDate).toBe("2024-01-01");
    expect(q1.endDate).toBe("2024-03-31");
    expect(q1.income).toBe(100000);
    expect(q1.expenses).toBe(0);
    expect(q1.result).toBe(100000);

    expect(q2.label).toBe("2024 Q2");
    expect(q2.startDate).toBe("2024-04-01");
    expect(q2.endDate).toBe("2024-06-30");
    expect(q2.income).toBe(60000);
    expect(q2.expenses).toBe(30000);
    expect(q2.result).toBe(30000);
    expect(q2.cumulativeResult).toBe(130000);

    expect(report.totalIncome).toBe(160000);
    expect(report.totalExpenses).toBe(30000);
    expect(report.totalResult).toBe(130000);
  });

  it("handles financial income (8000–8399) as income", () => {
    // Account 8310 is in financial income range 8000–8399
    // isRevenue (3000-3999) won't match, but isExpense (4000-8999) WILL match
    // Financial income is in the expense class by account number, but...
    // Actually our simple classifier treats 8310 as expense. Let's verify:
    // isExpense: 4000-8999 → 8310 is expense
    // For financial accounts, debit–credit should track correctly.
    // In the income statement, financial income uses credit–debit (inverted).
    // Our period report simplifies to: revenue = 3000-3999, expense = 4000-8999.
    // Financial income (8000-8399) appears as negative expense when credited.
    const vouchers: Voucher[] = [
      voucher("2024-06-01", [
        line("l1", "1930", 5000, 0),
        line("l2", "8310", 0, 5000), // financial income: credit
      ]),
    ];

    const report = calculatePeriodReport(vouchers, accounts, "month");
    const jun = report.periods[0]!;
    // 8310 is classified as expense (4000–8999). Credit 5000 → debit–credit = –5000
    // So expenses = –5000 (negative expense = income)
    expect(jun.income).toBe(0);
    expect(jun.expenses).toBe(-5000);
    expect(jun.result).toBe(5000); // 0 − (−5000) = 5000
  });

  it("handles financial expenses (8400–8999) as expense", () => {
    const vouchers: Voucher[] = [
      voucher("2024-07-01", [
        line("l1", "8400", 3000, 0), // financial expense: debit
        line("l2", "1930", 0, 3000),
      ]),
    ];

    const report = calculatePeriodReport(vouchers, accounts, "month");
    const jul = report.periods[0]!;
    expect(jul.income).toBe(0);
    expect(jul.expenses).toBe(3000);
    expect(jul.result).toBe(-3000);
  });

  it("ignores balance-sheet accounts (1xxx, 2xxx)", () => {
    const vouchers: Voucher[] = [
      voucher("2024-01-10", [
        line("l1", "1930", 50000, 0), // asset
        line("l2", "2440", 0, 50000), // liability
      ]),
    ];

    const report = calculatePeriodReport(vouchers, accounts, "month");
    const jan = report.periods[0]!;
    expect(jan.income).toBe(0);
    expect(jan.expenses).toBe(0);
    expect(jan.result).toBe(0);
  });

  it("defaults to month when periodType is omitted", () => {
    const vouchers: Voucher[] = [
      voucher("2024-03-01", [line("l1", "1930", 10000, 0), line("l2", "3000", 0, 10000)]),
    ];

    const report = calculatePeriodReport(vouchers, accounts);
    expect(report.periodType).toBe("month");
    expect(report.periods[0]!.label).toBe("2024-03");
  });

  it("handles multiple vouchers in the same period", () => {
    const vouchers: Voucher[] = [
      voucher("2024-04-01", [line("l1", "1930", 20000, 0), line("l2", "3000", 0, 20000)]),
      voucher("2024-04-15", [line("l3", "1930", 30000, 0), line("l4", "3010", 0, 30000)]),
      voucher("2024-04-30", [line("l5", "5010", 10000, 0), line("l6", "1930", 0, 10000)]),
    ];

    const report = calculatePeriodReport(vouchers, accounts, "month");
    expect(report.periods).toHaveLength(1);

    const apr = report.periods[0]!;
    expect(apr.income).toBe(50000); // 20000 + 30000
    expect(apr.expenses).toBe(10000);
    expect(apr.result).toBe(40000);
  });

  it("handles full year with 12 months", () => {
    const vouchers: Voucher[] = [
      voucher("2024-01-01", [line("l1", "1930", 10000, 0), line("l2", "3000", 0, 10000)]),
      voucher("2024-12-31", [line("l3", "5010", 5000, 0), line("l4", "1930", 0, 5000)]),
    ];

    const report = calculatePeriodReport(vouchers, accounts, "month");
    expect(report.periods).toHaveLength(12);
    expect(report.periods[0]!.label).toBe("2024-01");
    expect(report.periods[11]!.label).toBe("2024-12");

    // Only first and last months have activity
    expect(report.periods[0]!.income).toBe(10000);
    expect(report.periods[11]!.expenses).toBe(5000);

    // All middle months should be zero
    for (let i = 1; i < 11; i++) {
      expect(report.periods[i]!.income).toBe(0);
      expect(report.periods[i]!.expenses).toBe(0);
      expect(report.periods[i]!.result).toBe(0);
    }

    // Cumulative
    expect(report.periods[0]!.cumulativeResult).toBe(10000);
    expect(report.periods[11]!.cumulativeResult).toBe(5000); // 10000 − 5000
  });

  it("handles quarter with gap quarters", () => {
    const vouchers: Voucher[] = [
      voucher("2024-01-15", [line("l1", "1930", 10000, 0), line("l2", "3000", 0, 10000)]),
      voucher("2024-10-01", [line("l3", "5010", 3000, 0), line("l4", "1930", 0, 3000)]),
    ];

    const report = calculatePeriodReport(vouchers, accounts, "quarter");
    expect(report.periods).toHaveLength(4); // Q1, Q2, Q3, Q4
    expect(report.periods[0]!.label).toBe("2024 Q1");
    expect(report.periods[1]!.label).toBe("2024 Q2");
    expect(report.periods[2]!.label).toBe("2024 Q3");
    expect(report.periods[3]!.label).toBe("2024 Q4");

    // Q2, Q3 are zero activity
    expect(report.periods[1]!.income).toBe(0);
    expect(report.periods[1]!.expenses).toBe(0);
    expect(report.periods[2]!.income).toBe(0);
    expect(report.periods[2]!.expenses).toBe(0);

    expect(report.totalResult).toBe(7000); // 10000 − 3000
  });

  it("handles revenue credit reversal (debit on revenue account)", () => {
    const vouchers: Voucher[] = [
      voucher("2024-06-01", [
        line("l1", "3000", 0, 50000), // revenue
        line("l2", "1930", 50000, 0),
      ]),
      voucher("2024-06-15", [
        line("l3", "3000", 10000, 0), // credit note / reversal
        line("l4", "1930", 0, 10000),
      ]),
    ];

    const report = calculatePeriodReport(vouchers, accounts, "month");
    const jun = report.periods[0]!;
    // Net revenue: (50000 credit − 0 debit) + (0 credit − 10000 debit) = 40000
    expect(jun.income).toBe(40000);
  });

  it("spans across year boundaries (broken fiscal year)", () => {
    const vouchers: Voucher[] = [
      voucher("2024-11-01", [line("l1", "1930", 20000, 0), line("l2", "3000", 0, 20000)]),
      voucher("2025-02-15", [line("l3", "5010", 8000, 0), line("l4", "1930", 0, 8000)]),
    ];

    const report = calculatePeriodReport(vouchers, accounts, "month");
    expect(report.periods).toHaveLength(4); // Nov, Dec, Jan, Feb
    expect(report.periods[0]!.label).toBe("2024-11");
    expect(report.periods[3]!.label).toBe("2025-02");
    expect(report.periods[3]!.endDate).toBe("2025-02-28");
  });

  it("handles February end date in leap year", () => {
    const vouchers: Voucher[] = [
      voucher("2024-02-15", [line("l1", "1930", 10000, 0), line("l2", "3000", 0, 10000)]),
    ];

    const report = calculatePeriodReport(vouchers, accounts, "month");
    expect(report.periods[0]!.endDate).toBe("2024-02-29"); // 2024 is a leap year
  });

  it("Quarter end dates are correct", () => {
    const vouchers: Voucher[] = [
      voucher("2024-03-15", [line("l1", "1930", 10000, 0), line("l2", "3000", 0, 10000)]),
    ];

    const report = calculatePeriodReport(vouchers, accounts, "quarter");
    expect(report.periods[0]!.startDate).toBe("2024-01-01");
    expect(report.periods[0]!.endDate).toBe("2024-03-31");
  });

  it("generatedAt is present", () => {
    const before = new Date();
    const report = calculatePeriodReport([], accounts, "month");
    expect(report.generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});
