import { describe, it, expect } from "vitest";
import { isValidOrgNumber } from "./organization.js";

describe("isValidOrgNumber", () => {
  describe("valid organization numbers", () => {
    it("should accept a valid 10-digit org number", () => {
      // 556036-0793 is IKEA's org number (valid Luhn)
      expect(isValidOrgNumber("5560360793")).toBe(true);
    });

    it("should accept a valid 10-digit org number with dash", () => {
      expect(isValidOrgNumber("556036-0793")).toBe(true);
    });

    it("should accept a valid 12-digit org number (with century)", () => {
      // 165560360793 - same as above with century prefix
      expect(isValidOrgNumber("165560360793")).toBe(true);
    });

    it("should accept a valid personal number (personnummer)", () => {
      // 8507099805 - valid Swedish personal number
      expect(isValidOrgNumber("8507099805")).toBe(true);
    });

    it("should accept a valid personal number with dash", () => {
      expect(isValidOrgNumber("850709-9805")).toBe(true);
    });

    it("should accept association org numbers starting with 8", () => {
      // 802481-1658 - valid ideell förening format
      expect(isValidOrgNumber("8024811658")).toBe(true);
    });
  });

  describe("invalid organization numbers", () => {
    it("should reject org number with wrong check digit", () => {
      // Change last digit to make it invalid
      expect(isValidOrgNumber("5560360794")).toBe(false);
    });

    it("should reject org number with letters", () => {
      expect(isValidOrgNumber("556036079A")).toBe(false);
    });

    it("should reject org number that is too short", () => {
      expect(isValidOrgNumber("55603607")).toBe(false);
    });

    it("should reject org number that is too long", () => {
      expect(isValidOrgNumber("55603607931234")).toBe(false);
    });

    it("should reject 11-digit numbers", () => {
      expect(isValidOrgNumber("15560360793")).toBe(false);
    });

    it("should reject empty string", () => {
      expect(isValidOrgNumber("")).toBe(false);
    });

    it("should pass all zeros (Luhn sum is 0, valid checksum)", () => {
      // All zeros technically passes Luhn algorithm (0 % 10 === 0)
      expect(isValidOrgNumber("0000000000")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle multiple dashes", () => {
      expect(isValidOrgNumber("556-036-0793")).toBe(true);
    });

    it("should handle org number starting with 1 (century prefix)", () => {
      // Valid 12-digit with 19xx century
      expect(isValidOrgNumber("198507099805")).toBe(true);
    });

    it("should validate 12-digit with 19xx century prefix using Luhn on last 10", () => {
      // The implementation takes last 10 digits for Luhn validation
      // 198507099805 is valid - already tested 8507099805 in valid cases
      expect(isValidOrgNumber("198507099805")).toBe(true);
    });
  });
});
