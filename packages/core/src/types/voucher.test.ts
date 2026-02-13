import { describe, it, expect } from "vitest";
import {
  calculateTotalDebit,
  calculateTotalCredit,
  isVoucherBalanced,
} from "./voucher.js";
import type { CreateVoucherLineInput } from "./voucher-line.js";

const balancedLines: CreateVoucherLineInput[] = [
  { accountNumber: "1910", debit: 10000, credit: 0 },
  { accountNumber: "3000", debit: 0, credit: 10000 },
];

const unbalancedLines: CreateVoucherLineInput[] = [
  { accountNumber: "1910", debit: 10000, credit: 0 },
  { accountNumber: "3000", debit: 0, credit: 5000 },
];

const multiLineBalanced: CreateVoucherLineInput[] = [
  { accountNumber: "1910", debit: 20000, credit: 0 },
  { accountNumber: "3001", debit: 0, credit: 16000 },
  { accountNumber: "2610", debit: 0, credit: 4000 }, // 25% moms
];

describe("calculateTotalDebit", () => {
  it("should sum all debit amounts", () => {
    expect(calculateTotalDebit(balancedLines)).toBe(10000);
  });

  it("should handle multiple debit lines", () => {
    const lines: CreateVoucherLineInput[] = [
      { accountNumber: "5010", debit: 8000, credit: 0 },
      { accountNumber: "2640", debit: 2000, credit: 0 },
      { accountNumber: "1930", debit: 0, credit: 10000 },
    ];
    expect(calculateTotalDebit(lines)).toBe(10000);
  });

  it("should return 0 for empty lines", () => {
    expect(calculateTotalDebit([])).toBe(0);
  });

  it("should ignore credit amounts", () => {
    expect(calculateTotalDebit([
      { accountNumber: "3000", debit: 0, credit: 50000 },
    ])).toBe(0);
  });
});

describe("calculateTotalCredit", () => {
  it("should sum all credit amounts", () => {
    expect(calculateTotalCredit(balancedLines)).toBe(10000);
  });

  it("should handle multiple credit lines", () => {
    expect(calculateTotalCredit(multiLineBalanced)).toBe(20000);
  });

  it("should return 0 for empty lines", () => {
    expect(calculateTotalCredit([])).toBe(0);
  });

  it("should ignore debit amounts", () => {
    expect(calculateTotalCredit([
      { accountNumber: "1910", debit: 50000, credit: 0 },
    ])).toBe(0);
  });
});

describe("isVoucherBalanced", () => {
  it("should return true when debit equals credit", () => {
    expect(isVoucherBalanced(balancedLines)).toBe(true);
  });

  it("should return false when debit != credit", () => {
    expect(isVoucherBalanced(unbalancedLines)).toBe(false);
  });

  it("should return true for multi-line balanced voucher", () => {
    expect(isVoucherBalanced(multiLineBalanced)).toBe(true);
  });

  it("should return true for empty lines (0 === 0)", () => {
    expect(isVoucherBalanced([])).toBe(true);
  });

  it("should handle large amounts correctly (no floating point issues)", () => {
    const lines: CreateVoucherLineInput[] = [
      { accountNumber: "1910", debit: 99999999, credit: 0 },
      { accountNumber: "3000", debit: 0, credit: 99999999 },
    ];
    expect(isVoucherBalanced(lines)).toBe(true);
  });

  it("should detect 1 öre difference", () => {
    const lines: CreateVoucherLineInput[] = [
      { accountNumber: "1910", debit: 10001, credit: 0 },
      { accountNumber: "3000", debit: 0, credit: 10000 },
    ];
    expect(isVoucherBalanced(lines)).toBe(false);
  });
});
