import { describe, it, expect } from "vitest";
import { validateVoucher, createVoucherFromInput } from "./validate.js";
import type { CreateVoucherInput } from "../types/voucher.js";
import type { FiscalYear } from "../types/fiscal-year.js";
import type { Account } from "../types/account.js";

const fiscalYear: FiscalYear = {
  id: "fy-2025",
  organizationId: "org-1",
  startDate: new Date("2025-01-01"),
  endDate: new Date("2025-12-31"),
  isClosed: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const accounts: Account[] = [
  { number: "1910", name: "Kassa", type: "ASSET", isVatAccount: false, isActive: true },
  { number: "1930", name: "Företagskonto", type: "ASSET", isVatAccount: false, isActive: true },
  { number: "3000", name: "Försäljning", type: "REVENUE", isVatAccount: false, isActive: true },
  { number: "2610", name: "Utgående moms", type: "LIABILITY", isVatAccount: true, isActive: true },
];

describe("validateVoucher", () => {
  it("should accept a balanced voucher", () => {
    const input: CreateVoucherInput = {
      fiscalYearId: "fy-2025",
      organizationId: "org-1",
      date: new Date("2025-03-15"),
      description: "Kontantförsäljning",
      lines: [
        { accountNumber: "1910", debit: 12500, credit: 0 },
        { accountNumber: "3000", debit: 0, credit: 10000 },
        { accountNumber: "2610", debit: 0, credit: 2500 },
      ],
    };

    const result = validateVoucher(input, { fiscalYear, accounts });
    expect(result.ok).toBe(true);
  });

  it("should reject an unbalanced voucher", () => {
    const input: CreateVoucherInput = {
      fiscalYearId: "fy-2025",
      organizationId: "org-1",
      date: new Date("2025-03-15"),
      description: "Obalanserat",
      lines: [
        { accountNumber: "1910", debit: 10000, credit: 0 },
        { accountNumber: "3000", debit: 0, credit: 5000 },
      ],
    };

    const result = validateVoucher(input, { fiscalYear, accounts });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNBALANCED");
    }
  });

  it("should reject voucher with no lines", () => {
    const input: CreateVoucherInput = {
      fiscalYearId: "fy-2025",
      organizationId: "org-1",
      date: new Date("2025-03-15"),
      description: "Tom",
      lines: [],
    };

    const result = validateVoucher(input, { fiscalYear, accounts });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NO_LINES");
    }
  });

  it("should reject voucher with date outside fiscal year", () => {
    const input: CreateVoucherInput = {
      fiscalYearId: "fy-2025",
      organizationId: "org-1",
      date: new Date("2024-12-31"),
      description: "Fel datum",
      lines: [
        { accountNumber: "1910", debit: 10000, credit: 0 },
        { accountNumber: "3000", debit: 0, credit: 10000 },
      ],
    };

    const result = validateVoucher(input, { fiscalYear, accounts });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_DATE");
    }
  });

  it("should reject voucher with unknown account", () => {
    const input: CreateVoucherInput = {
      fiscalYearId: "fy-2025",
      organizationId: "org-1",
      date: new Date("2025-03-15"),
      description: "Okänt konto",
      lines: [
        { accountNumber: "1910", debit: 10000, credit: 0 },
        { accountNumber: "9999", debit: 0, credit: 10000 },
      ],
    };

    const result = validateVoucher(input, { fiscalYear, accounts });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ACCOUNT_NOT_FOUND");
    }
  });

  it("should reject voucher in closed fiscal year", () => {
    const closedFiscalYear = { ...fiscalYear, isClosed: true };
    const input: CreateVoucherInput = {
      fiscalYearId: "fy-2025",
      organizationId: "org-1",
      date: new Date("2025-03-15"),
      description: "Stängt år",
      lines: [
        { accountNumber: "1910", debit: 10000, credit: 0 },
        { accountNumber: "3000", debit: 0, credit: 10000 },
      ],
    };

    const result = validateVoucher(input, { fiscalYear: closedFiscalYear, accounts });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FISCAL_YEAR_CLOSED");
    }
  });
});

describe("createVoucherFromInput", () => {
  it("should create a voucher with generated IDs", () => {
    const input: CreateVoucherInput = {
      fiscalYearId: "fy-2025",
      organizationId: "org-1",
      date: new Date("2025-03-15"),
      description: "Kontantförsäljning",
      lines: [
        { accountNumber: "1910", debit: 12500, credit: 0 },
        { accountNumber: "3000", debit: 0, credit: 10000 },
        { accountNumber: "2610", debit: 0, credit: 2500 },
      ],
    };

    let lineIdCounter = 0;
    const voucher = createVoucherFromInput(input, {
      id: "voucher-1",
      voucherNumber: 1,
      lineIdGenerator: () => `line-${++lineIdCounter}`,
    });

    expect(voucher.id).toBe("voucher-1");
    expect(voucher.number).toBe(1);
    expect(voucher.lines).toHaveLength(3);
    expect(voucher.lines[0]?.id).toBe("line-1");
    expect(voucher.lines[1]?.id).toBe("line-2");
    expect(voucher.lines[2]?.id).toBe("line-3");
  });
});
