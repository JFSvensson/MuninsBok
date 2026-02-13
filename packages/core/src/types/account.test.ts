import { describe, it, expect } from "vitest";
import {
  getAccountTypeFromNumber,
  isValidAccountNumber,
  ACCOUNT_NUMBER_PATTERN,
} from "./account.js";

describe("getAccountTypeFromNumber", () => {
  describe("ASSET accounts (1xxx)", () => {
    it("should return ASSET for 1000-1999", () => {
      expect(getAccountTypeFromNumber("1000")).toBe("ASSET");
      expect(getAccountTypeFromNumber("1510")).toBe("ASSET"); // Kundfordringar
      expect(getAccountTypeFromNumber("1910")).toBe("ASSET"); // Kassa
      expect(getAccountTypeFromNumber("1999")).toBe("ASSET");
    });
  });

  describe("LIABILITY and EQUITY accounts (2xxx)", () => {
    it("should return LIABILITY for 2000-2079", () => {
      expect(getAccountTypeFromNumber("2000")).toBe("LIABILITY");
      expect(getAccountTypeFromNumber("2010")).toBe("LIABILITY");
      expect(getAccountTypeFromNumber("2079")).toBe("LIABILITY");
    });

    it("should return EQUITY for 2080-2099", () => {
      expect(getAccountTypeFromNumber("2080")).toBe("EQUITY");
      expect(getAccountTypeFromNumber("2081")).toBe("EQUITY"); // Aktiekapital
      expect(getAccountTypeFromNumber("2091")).toBe("EQUITY"); // Balanserad vinst
      expect(getAccountTypeFromNumber("2099")).toBe("EQUITY"); // Årets resultat
    });

    it("should return LIABILITY for 2100-2999", () => {
      expect(getAccountTypeFromNumber("2100")).toBe("LIABILITY");
      expect(getAccountTypeFromNumber("2440")).toBe("LIABILITY"); // Leverantörsskulder
      expect(getAccountTypeFromNumber("2610")).toBe("LIABILITY"); // Utgående moms
      expect(getAccountTypeFromNumber("2799")).toBe("LIABILITY");
    });
  });

  describe("REVENUE accounts (3xxx)", () => {
    it("should return REVENUE for 3000-3999", () => {
      expect(getAccountTypeFromNumber("3000")).toBe("REVENUE"); // Försäljning
      expect(getAccountTypeFromNumber("3001")).toBe("REVENUE"); // Försäljning 25% moms
      expect(getAccountTypeFromNumber("3910")).toBe("REVENUE"); // Hyresintäkter
      expect(getAccountTypeFromNumber("3999")).toBe("REVENUE");
    });
  });

  describe("EXPENSE accounts (4xxx-7xxx)", () => {
    it("should return EXPENSE for 4000-4999 (Inköp)", () => {
      expect(getAccountTypeFromNumber("4000")).toBe("EXPENSE");
      expect(getAccountTypeFromNumber("4010")).toBe("EXPENSE");
      expect(getAccountTypeFromNumber("4999")).toBe("EXPENSE");
    });

    it("should return EXPENSE for 5000-5999 (Lokalkostnader)", () => {
      expect(getAccountTypeFromNumber("5010")).toBe("EXPENSE"); // Lokalhyra
      expect(getAccountTypeFromNumber("5020")).toBe("EXPENSE"); // El
      expect(getAccountTypeFromNumber("5999")).toBe("EXPENSE");
    });

    it("should return EXPENSE for 6000-6999 (Övriga kostnader)", () => {
      expect(getAccountTypeFromNumber("6010")).toBe("EXPENSE"); // Kontorsmaterial
      expect(getAccountTypeFromNumber("6570")).toBe("EXPENSE"); // Bankkostnader
      expect(getAccountTypeFromNumber("6999")).toBe("EXPENSE");
    });

    it("should return EXPENSE for 7000-7999 (Personal)", () => {
      expect(getAccountTypeFromNumber("7010")).toBe("EXPENSE"); // Löner
      expect(getAccountTypeFromNumber("7510")).toBe("EXPENSE"); // Arbetsgivaravgifter
      expect(getAccountTypeFromNumber("7999")).toBe("EXPENSE");
    });
  });

  describe("financial accounts (8xxx)", () => {
    it("should return REVENUE for 8000-8399 (financial income)", () => {
      expect(getAccountTypeFromNumber("8310")).toBe("REVENUE"); // Ränteintäkter
      expect(getAccountTypeFromNumber("8314")).toBe("REVENUE"); // Skattefria ränteintäkter
      expect(getAccountTypeFromNumber("8399")).toBe("REVENUE");
    });

    it("should return EXPENSE for 8400-8999 (financial expenses)", () => {
      expect(getAccountTypeFromNumber("8410")).toBe("EXPENSE"); // Räntekostnader
      expect(getAccountTypeFromNumber("8420")).toBe("EXPENSE");
      expect(getAccountTypeFromNumber("8910")).toBe("EXPENSE"); // Skatt på årets resultat
      expect(getAccountTypeFromNumber("8999")).toBe("EXPENSE"); // Årets resultat
    });
  });

  describe("edge cases", () => {
    it("should return EXPENSE as default for invalid prefixes", () => {
      expect(getAccountTypeFromNumber("9000")).toBe("EXPENSE");
      expect(getAccountTypeFromNumber("0000")).toBe("EXPENSE");
    });
  });
});

describe("isValidAccountNumber", () => {
  describe("valid account numbers", () => {
    it("should accept 4-digit numbers starting with 1-8", () => {
      expect(isValidAccountNumber("1000")).toBe(true);
      expect(isValidAccountNumber("2440")).toBe(true);
      expect(isValidAccountNumber("3001")).toBe(true);
      expect(isValidAccountNumber("8999")).toBe(true);
    });
  });

  describe("invalid account numbers", () => {
    it("should reject numbers starting with 0", () => {
      expect(isValidAccountNumber("0100")).toBe(false);
    });

    it("should reject numbers starting with 9", () => {
      expect(isValidAccountNumber("9000")).toBe(false);
    });

    it("should reject 3-digit numbers", () => {
      expect(isValidAccountNumber("100")).toBe(false);
    });

    it("should reject 5-digit numbers", () => {
      expect(isValidAccountNumber("10000")).toBe(false);
    });

    it("should reject numbers with letters", () => {
      expect(isValidAccountNumber("10A0")).toBe(false);
    });

    it("should reject empty string", () => {
      expect(isValidAccountNumber("")).toBe(false);
    });

    it("should reject numbers with spaces", () => {
      expect(isValidAccountNumber("10 00")).toBe(false);
    });

    it("should reject numbers with dashes", () => {
      expect(isValidAccountNumber("10-00")).toBe(false);
    });
  });
});

describe("ACCOUNT_NUMBER_PATTERN", () => {
  it("should be a valid regex", () => {
    expect(ACCOUNT_NUMBER_PATTERN).toBeInstanceOf(RegExp);
  });

  it("should match valid account numbers", () => {
    expect(ACCOUNT_NUMBER_PATTERN.test("1000")).toBe(true);
    expect(ACCOUNT_NUMBER_PATTERN.test("8999")).toBe(true);
  });

  it("should not match invalid account numbers", () => {
    expect(ACCOUNT_NUMBER_PATTERN.test("0100")).toBe(false);
    expect(ACCOUNT_NUMBER_PATTERN.test("9000")).toBe(false);
    expect(ACCOUNT_NUMBER_PATTERN.test("100")).toBe(false);
  });
});
