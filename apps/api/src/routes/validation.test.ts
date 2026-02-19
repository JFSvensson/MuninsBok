import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ACCOUNT_NUMBER_PATTERN } from "@muninsbok/core";

/**
 * Tests for API validation schemas.
 * These test the Zod schemas used for request validation.
 */

const createAccountSchema = z.object({
  number: z.string().regex(ACCOUNT_NUMBER_PATTERN, "Kontonummer måste vara 4 siffror (1000-8999)"),
  name: z.string().min(1).max(255),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  isVatAccount: z.boolean().optional(),
});

describe("Account validation schema", () => {
  describe("valid inputs", () => {
    it("should accept valid account with required fields", () => {
      const input = {
        number: "1910",
        name: "Kassa",
        type: "ASSET",
      };
      const result = createAccountSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should accept account with optional isVatAccount", () => {
      const input = {
        number: "2610",
        name: "Utgående moms 25%",
        type: "LIABILITY",
        isVatAccount: true,
      };
      const result = createAccountSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should accept all valid account types", () => {
      const types = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];
      for (const type of types) {
        const result = createAccountSchema.safeParse({
          number: "1000",
          name: "Test",
          type,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("invalid account numbers", () => {
    it("should reject account number starting with 0", () => {
      const input = { number: "0100", name: "Invalid", type: "ASSET" };
      const result = createAccountSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject account number starting with 9", () => {
      const input = { number: "9000", name: "Invalid", type: "ASSET" };
      const result = createAccountSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject 3-digit account numbers", () => {
      const input = { number: "100", name: "Invalid", type: "ASSET" };
      const result = createAccountSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject 5-digit account numbers", () => {
      const input = { number: "10000", name: "Invalid", type: "ASSET" };
      const result = createAccountSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject account numbers with letters", () => {
      const input = { number: "1A00", name: "Invalid", type: "ASSET" };
      const result = createAccountSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("invalid names", () => {
    it("should reject empty name", () => {
      const input = { number: "1000", name: "", type: "ASSET" };
      const result = createAccountSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject name over 255 characters", () => {
      const input = { number: "1000", name: "a".repeat(256), type: "ASSET" };
      const result = createAccountSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("invalid types", () => {
    it("should reject invalid account type", () => {
      const input = { number: "1000", name: "Test", type: "INVALID" };
      const result = createAccountSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject lowercase account types", () => {
      const input = { number: "1000", name: "Test", type: "asset" };
      const result = createAccountSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("missing required fields", () => {
    it("should reject missing number", () => {
      const input = { name: "Test", type: "ASSET" };
      const result = createAccountSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject missing name", () => {
      const input = { number: "1000", type: "ASSET" };
      const result = createAccountSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject missing type", () => {
      const input = { number: "1000", name: "Test" };
      const result = createAccountSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

const createVoucherLineSchema = z.object({
  accountNumber: z.string().regex(ACCOUNT_NUMBER_PATTERN),
  debit: z.number().int().min(0),
  credit: z.number().int().min(0),
});

const createVoucherSchema = z.object({
  date: z.string(),
  description: z.string().min(1),
  lines: z.array(createVoucherLineSchema).min(2),
});

describe("Voucher validation schema", () => {
  it("should accept a valid balanced voucher", () => {
    const input = {
      date: "2025-03-15",
      description: "Test bokföringspost",
      lines: [
        { accountNumber: "1910", debit: 10000, credit: 0 },
        { accountNumber: "3000", debit: 0, credit: 10000 },
      ],
    };
    const result = createVoucherSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should reject voucher with less than 2 lines", () => {
    const input = {
      date: "2025-03-15",
      description: "Test",
      lines: [{ accountNumber: "1910", debit: 10000, credit: 0 }],
    };
    const result = createVoucherSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject voucher with empty description", () => {
    const input = {
      date: "2025-03-15",
      description: "",
      lines: [
        { accountNumber: "1910", debit: 10000, credit: 0 },
        { accountNumber: "3000", debit: 0, credit: 10000 },
      ],
    };
    const result = createVoucherSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject negative amounts", () => {
    const input = {
      date: "2025-03-15",
      description: "Test",
      lines: [
        { accountNumber: "1910", debit: -10000, credit: 0 },
        { accountNumber: "3000", debit: 0, credit: 10000 },
      ],
    };
    const result = createVoucherSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject decimal amounts (must be integers in öre)", () => {
    const input = {
      date: "2025-03-15",
      description: "Test",
      lines: [
        { accountNumber: "1910", debit: 100.5, credit: 0 },
        { accountNumber: "3000", debit: 0, credit: 100.5 },
      ],
    };
    const result = createVoucherSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
