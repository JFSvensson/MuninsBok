import { describe, it, expect } from "vitest";
import { generateJournal } from "./journal.js";
import { generateGeneralLedger } from "./general-ledger.js";
import { generateVoucherListReport } from "./voucher-list-report.js";
import type { Voucher } from "../types/voucher.js";
import type { Account } from "../types/account.js";

const accounts: Account[] = [
  { number: "1910", name: "Kassa", type: "ASSET", isVatAccount: false, isActive: true },
  { number: "1930", name: "Företagskonto", type: "ASSET", isVatAccount: false, isActive: true },
  { number: "2610", name: "Utgående moms", type: "LIABILITY", isVatAccount: true, isActive: true },
  { number: "3000", name: "Försäljning", type: "REVENUE", isVatAccount: false, isActive: true },
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
  {
    id: "v3",
    fiscalYearId: "fy-2025",
    organizationId: "org-1",
    number: 3,
    date: new Date("2025-01-10"),
    description: "Insättning",
    lines: [
      { id: "l6", voucherId: "v3", accountNumber: "1930", debit: 50000, credit: 0 },
      { id: "l7", voucherId: "v3", accountNumber: "1910", debit: 0, credit: 50000 },
    ],
    documentIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("generateJournal (Grundbok)", () => {
  it("should sort entries chronologically", () => {
    const result = generateJournal(vouchers, accounts);

    expect(result.entries).toHaveLength(3);
    // v3 (Jan 10) should come first, then v1 (Jan 15), then v2 (Jan 20)
    expect(result.entries[0]!.voucherNumber).toBe(3);
    expect(result.entries[1]!.voucherNumber).toBe(1);
    expect(result.entries[2]!.voucherNumber).toBe(2);
  });

  it("should include all lines for each entry", () => {
    const result = generateJournal(vouchers, accounts);

    const v1Entry = result.entries.find((e) => e.voucherNumber === 1)!;
    expect(v1Entry.lines).toHaveLength(3);
    expect(v1Entry.totalDebit).toBe(12500);
    expect(v1Entry.totalCredit).toBe(12500);
  });

  it("should calculate correct grand totals", () => {
    const result = generateJournal(vouchers, accounts);

    expect(result.totalDebit).toBe(70500); // 12500 + 8000 + 50000
    expect(result.totalCredit).toBe(70500); // 12500 + 8000 + 50000
  });

  it("should resolve account names", () => {
    const result = generateJournal(vouchers, accounts);

    const v1Entry = result.entries.find((e) => e.voucherNumber === 1)!;
    expect(v1Entry.lines[0]!.accountName).toBe("Kassa");
    expect(v1Entry.lines[1]!.accountName).toBe("Försäljning");
  });

  it("should handle empty vouchers", () => {
    const result = generateJournal([], accounts);

    expect(result.entries).toHaveLength(0);
    expect(result.totalDebit).toBe(0);
    expect(result.totalCredit).toBe(0);
  });
});

describe("generateGeneralLedger (Huvudbok)", () => {
  it("should group transactions by account", () => {
    const result = generateGeneralLedger(vouchers, accounts);

    // Accounts with activity: 1910, 1930, 2610, 3000, 5010
    expect(result.accounts).toHaveLength(5);
  });

  it("should sort accounts by account number", () => {
    const result = generateGeneralLedger(vouchers, accounts);

    const accountNumbers = result.accounts.map((a) => a.accountNumber);
    expect(accountNumbers).toEqual(["1910", "1930", "2610", "3000", "5010"]);
  });

  it("should calculate running balance per account", () => {
    const result = generateGeneralLedger(vouchers, accounts);

    // 1910 Kassa: v3 Jan 10 credit 50000 (bal -50000), v1 Jan 15 debit 12500 (bal -37500)
    const kassa = result.accounts.find((a) => a.accountNumber === "1910")!;
    expect(kassa.transactions).toHaveLength(2);
    expect(kassa.transactions[0]!.balance).toBe(-50000); // -50000
    expect(kassa.transactions[1]!.balance).toBe(-37500); // -50000 + 12500
    expect(kassa.closingBalance).toBe(-37500);
  });

  it("should sort transactions by date within an account", () => {
    const result = generateGeneralLedger(vouchers, accounts);

    const kassa = result.accounts.find((a) => a.accountNumber === "1910")!;
    expect(kassa.transactions[0]!.voucherNumber).toBe(3); // Jan 10
    expect(kassa.transactions[1]!.voucherNumber).toBe(1); // Jan 15
  });

  it("should calculate total debit and credit per account", () => {
    const result = generateGeneralLedger(vouchers, accounts);

    const kassa = result.accounts.find((a) => a.accountNumber === "1910")!;
    expect(kassa.totalDebit).toBe(12500);
    expect(kassa.totalCredit).toBe(50000);
  });

  it("should handle empty vouchers", () => {
    const result = generateGeneralLedger([], accounts);

    expect(result.accounts).toHaveLength(0);
  });
});

describe("generateVoucherListReport (Verifikationslista)", () => {
  it("should sort entries by voucher number", () => {
    const result = generateVoucherListReport(vouchers, accounts);

    expect(result.entries).toHaveLength(3);
    expect(result.entries[0]!.voucherNumber).toBe(1);
    expect(result.entries[1]!.voucherNumber).toBe(2);
    expect(result.entries[2]!.voucherNumber).toBe(3);
  });

  it("should report voucher count", () => {
    const result = generateVoucherListReport(vouchers, accounts);
    expect(result.count).toBe(3);
  });

  it("should include all lines for each voucher", () => {
    const result = generateVoucherListReport(vouchers, accounts);

    const v1Entry = result.entries.find((e) => e.voucherNumber === 1)!;
    expect(v1Entry.lines).toHaveLength(3);
  });

  it("should calculate correct totals", () => {
    const result = generateVoucherListReport(vouchers, accounts);

    expect(result.totalDebit).toBe(70500);
    expect(result.totalCredit).toBe(70500);
  });

  it("should include createdBy when present", () => {
    const vouchersWithCreatedBy: Voucher[] = [
      {
        ...vouchers[0]!,
        createdBy: "admin",
      },
    ];

    const result = generateVoucherListReport(vouchersWithCreatedBy, accounts);
    expect(result.entries[0]!.createdBy).toBe("admin");
  });

  it("should handle empty vouchers", () => {
    const result = generateVoucherListReport([], accounts);

    expect(result.entries).toHaveLength(0);
    expect(result.count).toBe(0);
    expect(result.totalDebit).toBe(0);
    expect(result.totalCredit).toBe(0);
  });
});
