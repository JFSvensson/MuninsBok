import { describe, it, expect } from "vitest";
import { validateVoucherLine } from "./voucher-line.js";
import type { CreateVoucherLineInput } from "./voucher-line.js";

describe("validateVoucherLine", () => {
  describe("valid lines", () => {
    it("should accept debit-only line", () => {
      const line: CreateVoucherLineInput = {
        accountNumber: "1910",
        debit: 10000,
        credit: 0,
      };
      expect(validateVoucherLine(line)).toBeNull();
    });

    it("should accept credit-only line", () => {
      const line: CreateVoucherLineInput = {
        accountNumber: "3000",
        debit: 0,
        credit: 10000,
      };
      expect(validateVoucherLine(line)).toBeNull();
    });

    it("should accept 1 öre amounts", () => {
      const line: CreateVoucherLineInput = {
        accountNumber: "1910",
        debit: 1,
        credit: 0,
      };
      expect(validateVoucherLine(line)).toBeNull();
    });

    it("should accept large amounts", () => {
      const line: CreateVoucherLineInput = {
        accountNumber: "1910",
        debit: 999999999,
        credit: 0,
      };
      expect(validateVoucherLine(line)).toBeNull();
    });
  });

  describe("negative amounts", () => {
    it("should reject negative debit", () => {
      const line: CreateVoucherLineInput = {
        accountNumber: "1910",
        debit: -100,
        credit: 0,
      };
      const error = validateVoucherLine(line);
      expect(error).not.toBeNull();
      expect(error!.code).toBe("NEGATIVE_AMOUNT");
    });

    it("should reject negative credit", () => {
      const line: CreateVoucherLineInput = {
        accountNumber: "3000",
        debit: 0,
        credit: -100,
      };
      const error = validateVoucherLine(line);
      expect(error).not.toBeNull();
      expect(error!.code).toBe("NEGATIVE_AMOUNT");
    });
  });

  describe("both debit and credit", () => {
    it("should reject line with both debit and credit", () => {
      const line: CreateVoucherLineInput = {
        accountNumber: "1910",
        debit: 5000,
        credit: 5000,
      };
      const error = validateVoucherLine(line);
      expect(error).not.toBeNull();
      expect(error!.code).toBe("BOTH_DEBIT_AND_CREDIT");
    });
  });

  describe("zero amounts", () => {
    it("should reject line with both debit and credit as zero", () => {
      const line: CreateVoucherLineInput = {
        accountNumber: "1910",
        debit: 0,
        credit: 0,
      };
      const error = validateVoucherLine(line);
      expect(error).not.toBeNull();
      expect(error!.code).toBe("ZERO_AMOUNT");
    });
  });

  describe("error messages are in Swedish", () => {
    it("should have Swedish message for negative amount", () => {
      const error = validateVoucherLine({
        accountNumber: "1910",
        debit: -1,
        credit: 0,
      });
      expect(error!.message).toContain("negativt");
    });

    it("should have Swedish message for both debit/credit", () => {
      const error = validateVoucherLine({
        accountNumber: "1910",
        debit: 1,
        credit: 1,
      });
      expect(error!.message).toContain("debet");
      expect(error!.message).toContain("kredit");
    });

    it("should have Swedish message for zero amount", () => {
      const error = validateVoucherLine({
        accountNumber: "1910",
        debit: 0,
        credit: 0,
      });
      expect(error!.message).toContain("Belopp");
    });
  });
});
