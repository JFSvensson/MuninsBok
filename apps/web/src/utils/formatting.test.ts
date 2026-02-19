import { describe, it, expect } from "vitest";
import {
  formatAmount,
  formatDate,
  amountClassName,
  parseAmountToOre,
  oreToKronor,
} from "./formatting.js";

describe("parseAmountToOre", () => {
  describe("valid inputs", () => {
    it("should parse integer amounts", () => {
      expect(parseAmountToOre("100")).toBe(10000);
      expect(parseAmountToOre("1")).toBe(100);
      expect(parseAmountToOre("0")).toBe(0);
    });

    it("should parse decimal amounts with period", () => {
      expect(parseAmountToOre("100.50")).toBe(10050);
      expect(parseAmountToOre("99.99")).toBe(9999);
      expect(parseAmountToOre("0.01")).toBe(1);
    });

    it("should parse decimal amounts with comma (Swedish format)", () => {
      expect(parseAmountToOre("100,50")).toBe(10050);
      expect(parseAmountToOre("99,99")).toBe(9999);
      expect(parseAmountToOre("0,01")).toBe(1);
    });

    it("should handle negative amounts", () => {
      expect(parseAmountToOre("-100")).toBe(-10000);
      expect(parseAmountToOre("-50.25")).toBe(-5025);
    });

    it("should round to nearest öre", () => {
      expect(parseAmountToOre("100.555")).toBe(10056); // Rounds up
      expect(parseAmountToOre("100.554")).toBe(10055); // Rounds down
    });
  });

  describe("edge cases and invalid inputs", () => {
    it("should return 0 for empty string", () => {
      expect(parseAmountToOre("")).toBe(0);
    });

    it("should return 0 for whitespace-only string", () => {
      expect(parseAmountToOre("   ")).toBe(0);
    });

    it("should return 0 for non-numeric strings", () => {
      expect(parseAmountToOre("abc")).toBe(0);
      expect(parseAmountToOre("foo123")).toBe(0);
    });

    it("should handle strings with leading zeros", () => {
      expect(parseAmountToOre("0100")).toBe(10000);
      expect(parseAmountToOre("007")).toBe(700);
    });
  });
});

describe("formatAmount", () => {
  it("should format positive amounts with Swedish locale", () => {
    const result = formatAmount(1234.56);
    // Swedish format uses space as thousand separator and comma for decimals
    expect(result).toMatch(/1[\s ]?234,56/);
  });

  it("should format negative amounts", () => {
    const result = formatAmount(-500.0);
    expect(result).toMatch(/-?500,00/);
  });

  it("should always show 2 decimal places", () => {
    const result = formatAmount(100);
    expect(result).toContain(",00");
  });

  it("should format large amounts with thousand separators", () => {
    const result = formatAmount(1000000);
    // Should contain some form of thousand separator
    expect(result.length).toBeGreaterThan(10); // "1 000 000,00" is 12 chars
  });
});

describe("formatDate", () => {
  it("should format Date object with Swedish locale", () => {
    const date = new Date("2025-03-15");
    const result = formatDate(date);
    // Swedish date format: YYYY-MM-DD
    expect(result).toBe("2025-03-15");
  });

  it("should format ISO date string", () => {
    const result = formatDate("2025-12-31");
    expect(result).toBe("2025-12-31");
  });
});

describe("amountClassName", () => {
  it("should return positive class for positive amounts", () => {
    const result = amountClassName(100);
    expect(result).toContain("positive");
  });

  it("should return positive class for zero", () => {
    const result = amountClassName(0);
    expect(result).toContain("positive");
  });

  it("should return negative class for negative amounts", () => {
    const result = amountClassName(-50);
    expect(result).toContain("negative");
  });

  it("should include base class by default", () => {
    const result = amountClassName(100);
    expect(result).toContain("text-right");
    expect(result).toContain("amount");
  });

  it("should exclude base class when requested", () => {
    const result = amountClassName(100, false);
    expect(result).not.toContain("text-right");
    expect(result).not.toContain("amount");
    expect(result).toBe("positive");
  });
});

describe("oreToKronor", () => {
  it("should convert öre to kronor", () => {
    expect(oreToKronor(10000)).toBe(100);
    expect(oreToKronor(10050)).toBe(100.5);
    expect(oreToKronor(1)).toBe(0.01);
  });

  it("should handle negative values", () => {
    expect(oreToKronor(-5000)).toBe(-50);
  });

  it("should handle zero", () => {
    expect(oreToKronor(0)).toBe(0);
  });
});
