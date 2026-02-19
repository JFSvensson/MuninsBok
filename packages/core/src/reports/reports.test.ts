import { describe, it, expect } from "vitest";
import { calculateTrialBalance } from "./trial-balance.js";
import { calculateIncomeStatement } from "./income-statement.js";
import { calculateBalanceSheet } from "./balance-sheet.js";
import { calculateVatReport } from "./vat-report.js";
import type { Voucher } from "../types/voucher.js";
import type { Account } from "../types/account.js";

const accounts: Account[] = [
  { number: "1910", name: "Kassa", type: "ASSET", isVatAccount: false, isActive: true },
  { number: "1930", name: "Företagskonto", type: "ASSET", isVatAccount: false, isActive: true },
  {
    number: "2440",
    name: "Leverantörsskulder",
    type: "LIABILITY",
    isVatAccount: false,
    isActive: true,
  },
  { number: "2610", name: "Utgående moms", type: "LIABILITY", isVatAccount: true, isActive: true },
  { number: "2080", name: "Eget kapital", type: "EQUITY", isVatAccount: false, isActive: true },
  { number: "3000", name: "Försäljning", type: "REVENUE", isVatAccount: false, isActive: true },
  { number: "4000", name: "Inköp", type: "EXPENSE", isVatAccount: false, isActive: true },
  { number: "5010", name: "Lokalhyra", type: "EXPENSE", isVatAccount: false, isActive: true },
];

const vouchers: Voucher[] = [
  {
    id: "v1",
    fiscalYearId: "fy-2025",
    organizationId: "org-1",
    number: 1,
    date: new Date("2025-01-15"),
    description: "Kontantförsäljning",
    lines: [
      { id: "l1", voucherId: "v1", accountNumber: "1910", debit: 12500, credit: 0 },
      { id: "l2", voucherId: "v1", accountNumber: "3000", debit: 0, credit: 10000 },
      { id: "l3", voucherId: "v1", accountNumber: "2610", debit: 0, credit: 2500 },
    ],
    documentIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "v2",
    fiscalYearId: "fy-2025",
    organizationId: "org-1",
    number: 2,
    date: new Date("2025-01-20"),
    description: "Hyra januari",
    lines: [
      { id: "l4", voucherId: "v2", accountNumber: "5010", debit: 8000, credit: 0 },
      { id: "l5", voucherId: "v2", accountNumber: "1930", debit: 0, credit: 8000 },
    ],
    documentIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("calculateTrialBalance", () => {
  it("should calculate correct totals per account", () => {
    const result = calculateTrialBalance(vouchers, accounts);

    expect(result.rows).toHaveLength(5);
    expect(result.totalDebit).toBe(20500);
    expect(result.totalCredit).toBe(20500);

    const kassaRow = result.rows.find((r) => r.accountNumber === "1910");
    expect(kassaRow?.debit).toBe(12500);
    expect(kassaRow?.credit).toBe(0);
    expect(kassaRow?.balance).toBe(12500);

    const salesRow = result.rows.find((r) => r.accountNumber === "3000");
    expect(salesRow?.debit).toBe(0);
    expect(salesRow?.credit).toBe(10000);
    expect(salesRow?.balance).toBe(-10000);
  });

  it("should return empty rows for no vouchers", () => {
    const result = calculateTrialBalance([], accounts);
    expect(result.rows).toHaveLength(0);
    expect(result.totalDebit).toBe(0);
    expect(result.totalCredit).toBe(0);
  });
});

describe("calculateIncomeStatement", () => {
  it("should calculate revenues and expenses correctly", () => {
    const result = calculateIncomeStatement(vouchers, accounts);

    expect(result.revenues.total).toBe(10000); // 3000 Försäljning credit
    expect(result.expenses.total).toBe(8000); // 5010 Hyra debit
    expect(result.operatingResult).toBe(2000); // 10000 - 8000
    expect(result.netResult).toBe(2000);
  });

  it("should have revenue as positive amount", () => {
    const result = calculateIncomeStatement(vouchers, accounts);
    const salesRow = result.revenues.rows.find((r) => r.accountNumber === "3000");
    expect(salesRow?.amount).toBe(10000);
  });
});

describe("calculateBalanceSheet", () => {
  it("should calculate assets and liabilities correctly", () => {
    const result = calculateBalanceSheet(vouchers, accounts);

    // Assets: 1910 Kassa 12500, 1930 Företagskonto -8000 = 4500
    expect(result.assets.total).toBe(4500);

    // Liabilities: 2610 Moms 2500
    expect(result.liabilities.total).toBe(2500);

    // Year result: 10000 revenue - 8000 expense = 2000
    expect(result.yearResult).toBe(2000);

    // Total liabilities + equity + year result should equal assets
    expect(result.totalLiabilitiesAndEquity).toBe(4500);
    expect(result.difference).toBe(0);
  });
});

describe("calculateVatReport", () => {
  const vatAccounts: Account[] = [
    { number: "1910", name: "Kassa", type: "ASSET", isVatAccount: false, isActive: true },
    {
      number: "3000",
      name: "Försäljning 25%",
      type: "REVENUE",
      isVatAccount: false,
      isActive: true,
    },
    {
      number: "3100",
      name: "Försäljning 12%",
      type: "REVENUE",
      isVatAccount: false,
      isActive: true,
    },
    {
      number: "2610",
      name: "Utgående moms 25%",
      type: "LIABILITY",
      isVatAccount: true,
      isActive: true,
    },
    {
      number: "2620",
      name: "Utgående moms 12%",
      type: "LIABILITY",
      isVatAccount: true,
      isActive: true,
    },
    {
      number: "2640",
      name: "Ingående moms",
      type: "LIABILITY",
      isVatAccount: true,
      isActive: true,
    },
    { number: "4000", name: "Inköp", type: "EXPENSE", isVatAccount: false, isActive: true },
    {
      number: "2440",
      name: "Leverantörsskulder",
      type: "LIABILITY",
      isVatAccount: false,
      isActive: true,
    },
  ];

  const vatVouchers: Voucher[] = [
    {
      id: "vv1",
      fiscalYearId: "fy-2025",
      organizationId: "org-1",
      number: 1,
      date: new Date("2025-01-15"),
      description: "Försäljning 25% moms",
      lines: [
        { id: "vl1", voucherId: "vv1", accountNumber: "1910", debit: 12500, credit: 0 },
        { id: "vl2", voucherId: "vv1", accountNumber: "3000", debit: 0, credit: 10000 },
        { id: "vl3", voucherId: "vv1", accountNumber: "2610", debit: 0, credit: 2500 },
      ],
      documentIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "vv2",
      fiscalYearId: "fy-2025",
      organizationId: "org-1",
      number: 2,
      date: new Date("2025-01-20"),
      description: "Försäljning 12% moms",
      lines: [
        { id: "vl4", voucherId: "vv2", accountNumber: "1910", debit: 11200, credit: 0 },
        { id: "vl5", voucherId: "vv2", accountNumber: "3100", debit: 0, credit: 10000 },
        { id: "vl6", voucherId: "vv2", accountNumber: "2620", debit: 0, credit: 1200 },
      ],
      documentIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "vv3",
      fiscalYearId: "fy-2025",
      organizationId: "org-1",
      number: 3,
      date: new Date("2025-01-25"),
      description: "Inköp med moms",
      lines: [
        { id: "vl7", voucherId: "vv3", accountNumber: "4000", debit: 8000, credit: 0 },
        { id: "vl8", voucherId: "vv3", accountNumber: "2640", debit: 2000, credit: 0 },
        { id: "vl9", voucherId: "vv3", accountNumber: "2440", debit: 0, credit: 10000 },
      ],
      documentIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  it("should calculate output VAT correctly", () => {
    const result = calculateVatReport(vatVouchers, vatAccounts);

    expect(result.outputVat).toHaveLength(2);
    expect(result.outputVat[0]).toEqual(
      expect.objectContaining({ accountNumber: "2610", amount: 2500 }),
    );
    expect(result.outputVat[1]).toEqual(
      expect.objectContaining({ accountNumber: "2620", amount: 1200 }),
    );
    expect(result.totalOutputVat).toBe(3700);
  });

  it("should calculate input VAT correctly", () => {
    const result = calculateVatReport(vatVouchers, vatAccounts);

    expect(result.inputVat).toHaveLength(1);
    expect(result.inputVat[0]).toEqual(
      expect.objectContaining({ accountNumber: "2640", amount: 2000 }),
    );
    expect(result.totalInputVat).toBe(2000);
  });

  it("should calculate VAT payable correctly", () => {
    const result = calculateVatReport(vatVouchers, vatAccounts);

    // 3700 utgående - 2000 ingående = 1700 att betala
    expect(result.vatPayable).toBe(1700);
  });

  it("should return empty report for no vouchers", () => {
    const result = calculateVatReport([], vatAccounts);

    expect(result.outputVat).toHaveLength(0);
    expect(result.inputVat).toHaveLength(0);
    expect(result.totalOutputVat).toBe(0);
    expect(result.totalInputVat).toBe(0);
    expect(result.vatPayable).toBe(0);
  });
});
