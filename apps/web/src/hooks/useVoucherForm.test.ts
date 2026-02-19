/**
 * Tests for useVoucherForm hook logic.
 * Tests the pure calculation and validation logic extracted from the hook.
 */
import { describe, it, expect } from "vitest";
import { parseAmountToOre } from "../utils/formatting";

/**
 * Replicate the hook's computation logic for unit testing
 * without needing React / jsdom / QueryClient.
 */
interface VoucherLineInput {
  accountNumber: string;
  debit: string;
  credit: string;
  description: string;
}

function computeTotals(lines: VoucherLineInput[]) {
  const totalDebit = lines.reduce((sum, l) => sum + parseFloat(l.debit || "0"), 0);
  const totalCredit = lines.reduce((sum, l) => sum + parseFloat(l.credit || "0"), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const canSubmit = isBalanced && totalDebit > 0;
  return { totalDebit, totalCredit, isBalanced, canSubmit };
}

function prepareVoucherLines(lines: VoucherLineInput[]) {
  return lines
    .filter((l) => l.accountNumber && (l.debit || l.credit))
    .map((l) => ({
      accountNumber: l.accountNumber,
      debit: parseAmountToOre(l.debit),
      credit: parseAmountToOre(l.credit),
      description: l.description || undefined,
    }));
}

describe("Voucher form - totals computation", () => {
  it("calculates correct totals for balanced voucher", () => {
    const lines: VoucherLineInput[] = [
      { accountNumber: "1930", debit: "500", credit: "", description: "" },
      { accountNumber: "3000", debit: "", credit: "500", description: "" },
    ];

    const { totalDebit, totalCredit, isBalanced, canSubmit } = computeTotals(lines);

    expect(totalDebit).toBe(500);
    expect(totalCredit).toBe(500);
    expect(isBalanced).toBe(true);
    expect(canSubmit).toBe(true);
  });

  it("detects unbalanced voucher", () => {
    const lines: VoucherLineInput[] = [
      { accountNumber: "1930", debit: "500", credit: "", description: "" },
      { accountNumber: "3000", debit: "", credit: "300", description: "" },
    ];

    const { isBalanced, canSubmit } = computeTotals(lines);

    expect(isBalanced).toBe(false);
    expect(canSubmit).toBe(false);
  });

  it("handles empty lines as zero", () => {
    const lines: VoucherLineInput[] = [
      { accountNumber: "", debit: "", credit: "", description: "" },
      { accountNumber: "", debit: "", credit: "", description: "" },
    ];

    const { totalDebit, totalCredit, isBalanced, canSubmit } = computeTotals(lines);

    expect(totalDebit).toBe(0);
    expect(totalCredit).toBe(0);
    expect(isBalanced).toBe(true);
    expect(canSubmit).toBe(false); // canSubmit requires totalDebit > 0
  });

  it("handles floating point precision edge case", () => {
    const lines: VoucherLineInput[] = [
      { accountNumber: "1930", debit: "0.1", credit: "", description: "" },
      { accountNumber: "1930", debit: "0.2", credit: "", description: "" },
      { accountNumber: "3000", debit: "", credit: "0.3", description: "" },
    ];

    const { isBalanced } = computeTotals(lines);
    // 0.1 + 0.2 = 0.30000000000000004, but within 0.01 tolerance
    expect(isBalanced).toBe(true);
  });

  it("handles decimal amounts", () => {
    const lines: VoucherLineInput[] = [
      { accountNumber: "1930", debit: "1234.50", credit: "", description: "" },
      { accountNumber: "3000", debit: "", credit: "1234.50", description: "" },
    ];

    const { totalDebit, totalCredit, isBalanced } = computeTotals(lines);

    expect(totalDebit).toBe(1234.5);
    expect(totalCredit).toBe(1234.5);
    expect(isBalanced).toBe(true);
  });
});

describe("Voucher form - line preparation", () => {
  it("converts amounts to ören", () => {
    const lines: VoucherLineInput[] = [
      { accountNumber: "1930", debit: "500", credit: "", description: "Bank" },
      { accountNumber: "3000", debit: "", credit: "500", description: "" },
    ];

    const prepared = prepareVoucherLines(lines);

    expect(prepared).toEqual([
      { accountNumber: "1930", debit: 50000, credit: 0, description: "Bank" },
      { accountNumber: "3000", debit: 0, credit: 50000, description: undefined },
    ]);
  });

  it("filters out empty lines", () => {
    const lines: VoucherLineInput[] = [
      { accountNumber: "1930", debit: "500", credit: "", description: "" },
      { accountNumber: "", debit: "", credit: "", description: "" },
      { accountNumber: "3000", debit: "", credit: "500", description: "" },
    ];

    const prepared = prepareVoucherLines(lines);

    expect(prepared).toHaveLength(2);
  });

  it("filters out lines with account but no amounts", () => {
    const lines: VoucherLineInput[] = [
      { accountNumber: "1930", debit: "", credit: "", description: "" },
      { accountNumber: "3000", debit: "", credit: "500", description: "" },
    ];

    const prepared = prepareVoucherLines(lines);

    expect(prepared).toHaveLength(1);
    expect(prepared[0]!.accountNumber).toBe("3000");
  });

  it("handles decimal precision correctly (kr to ören)", () => {
    const lines: VoucherLineInput[] = [
      { accountNumber: "1930", debit: "99.99", credit: "", description: "" },
      { accountNumber: "3000", debit: "", credit: "99.99", description: "" },
    ];

    const prepared = prepareVoucherLines(lines);

    expect(prepared[0]!.debit).toBe(9999);
    expect(prepared[1]!.credit).toBe(9999);
  });
});

describe("Voucher form - line operations", () => {
  function createEmptyLine(): VoucherLineInput {
    return { accountNumber: "", debit: "", credit: "", description: "" };
  }

  it("updateLine modifies correct field", () => {
    const lines = [createEmptyLine(), createEmptyLine()];
    const updated = lines.map((line, i) => (i === 0 ? { ...line, accountNumber: "1930" } : line));

    expect(updated[0]!.accountNumber).toBe("1930");
    expect(updated[1]!.accountNumber).toBe("");
  });

  it("addLine adds new empty line", () => {
    const lines = [createEmptyLine(), createEmptyLine()];
    const updated = [...lines, createEmptyLine()];

    expect(updated).toHaveLength(3);
  });

  it("removeLine does not go below minimum 2 lines", () => {
    const lines = [createEmptyLine(), createEmptyLine()];
    // Mimic hook logic: minimum 2 lines
    const updated = lines.length <= 2 ? lines : lines.filter((_, i) => i !== 0);

    expect(updated).toHaveLength(2);
  });

  it("removeLine removes line when > 2", () => {
    const lines = [createEmptyLine(), createEmptyLine(), createEmptyLine()];
    const updated = lines.filter((_, i) => i !== 1);

    expect(updated).toHaveLength(2);
  });
});
