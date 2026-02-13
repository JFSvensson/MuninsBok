import { describe, it, expect } from "vitest";
import {
  BAS_SIMPLIFIED,
  getAccountsByType,
  getAccountByNumber,
  getVatAccounts,
} from "./bas-simplified.js";
import { getAccountTypeFromNumber, isValidAccountNumber } from "../types/account.js";

describe("BAS_SIMPLIFIED", () => {
  describe("structure validation", () => {
    it("should have approximately 100 accounts", () => {
      // We specified ~100 accounts in the requirements
      expect(BAS_SIMPLIFIED.length).toBeGreaterThanOrEqual(80);
      expect(BAS_SIMPLIFIED.length).toBeLessThanOrEqual(120);
    });

    it("should have no duplicate account numbers", () => {
      const numbers = BAS_SIMPLIFIED.map((a) => a.number);
      const uniqueNumbers = new Set(numbers);
      expect(uniqueNumbers.size).toBe(numbers.length);
    });

    it("should have all accounts with valid 4-digit numbers", () => {
      for (const account of BAS_SIMPLIFIED) {
        expect(isValidAccountNumber(account.number)).toBe(true);
      }
    });

    it("should have all accounts with non-empty names", () => {
      for (const account of BAS_SIMPLIFIED) {
        expect(account.name.length).toBeGreaterThan(0);
        expect(account.name.trim()).toBe(account.name);
      }
    });

    it("should have all accounts marked as active", () => {
      for (const account of BAS_SIMPLIFIED) {
        expect(account.isActive).toBe(true);
      }
    });
  });

  describe("account type consistency", () => {
    it("should have accounts with types matching BAS numbering convention", () => {
      for (const account of BAS_SIMPLIFIED) {
        const expectedType = getAccountTypeFromNumber(account.number);
        // Allow some flexibility for the 2xxx range which has both LIABILITY and EQUITY
        if (account.number.startsWith("2")) {
          expect(["LIABILITY", "EQUITY"]).toContain(account.type);
        } else if (account.number.startsWith("8")) {
          // 8xxx can be REVENUE (8000-8399) or EXPENSE (8400-8999)
          expect(["REVENUE", "EXPENSE"]).toContain(account.type);
        } else {
          expect(account.type).toBe(expectedType);
        }
      }
    });

    it("should have 1xxx accounts as ASSET", () => {
      const assetAccounts = BAS_SIMPLIFIED.filter((a) => a.number.startsWith("1"));
      expect(assetAccounts.length).toBeGreaterThan(0);
      for (const account of assetAccounts) {
        expect(account.type).toBe("ASSET");
      }
    });

    it("should have 3xxx accounts as REVENUE", () => {
      const revenueAccounts = BAS_SIMPLIFIED.filter((a) => a.number.startsWith("3"));
      expect(revenueAccounts.length).toBeGreaterThan(0);
      for (const account of revenueAccounts) {
        expect(account.type).toBe("REVENUE");
      }
    });

    it("should have 4xxx-7xxx accounts as EXPENSE", () => {
      const expenseAccounts = BAS_SIMPLIFIED.filter((a) => {
        const prefix = a.number.charAt(0);
        return ["4", "5", "6", "7"].includes(prefix);
      });
      expect(expenseAccounts.length).toBeGreaterThan(0);
      for (const account of expenseAccounts) {
        expect(account.type).toBe("EXPENSE");
      }
    });
  });

  describe("VAT accounts", () => {
    it("should have VAT accounts marked correctly", () => {
      const vatAccounts = BAS_SIMPLIFIED.filter((a) => a.isVatAccount);
      expect(vatAccounts.length).toBeGreaterThan(0);

      // VAT accounts should typically be in 16xx, 26xx ranges
      for (const account of vatAccounts) {
        const prefix = account.number.substring(0, 2);
        expect(["16", "26"]).toContain(prefix);
      }
    });

    it("should include common VAT account numbers", () => {
      const vatAccountNumbers = ["1650", "2610", "2620", "2630", "2640", "2650"];
      for (const number of vatAccountNumbers) {
        const account = BAS_SIMPLIFIED.find((a) => a.number === number);
        expect(account).toBeDefined();
        expect(account?.isVatAccount).toBe(true);
      }
    });
  });

  describe("essential accounts coverage", () => {
    it("should include essential cash/bank accounts", () => {
      expect(getAccountByNumber(BAS_SIMPLIFIED, "1910")).toBeDefined(); // Kassa
      expect(getAccountByNumber(BAS_SIMPLIFIED, "1920")).toBeDefined(); // PlusGiro
      expect(getAccountByNumber(BAS_SIMPLIFIED, "1930")).toBeDefined(); // Företagskonto
    });

    it("should include essential liability accounts", () => {
      expect(getAccountByNumber(BAS_SIMPLIFIED, "2440")).toBeDefined(); // Leverantörsskulder
      expect(getAccountByNumber(BAS_SIMPLIFIED, "2710")).toBeDefined(); // Personalskatt
    });

    it("should include essential revenue accounts", () => {
      expect(getAccountByNumber(BAS_SIMPLIFIED, "3000")).toBeDefined(); // Försäljning
      expect(getAccountByNumber(BAS_SIMPLIFIED, "3001")).toBeDefined(); // Försäljning 25% moms
    });

    it("should include essential expense accounts", () => {
      expect(getAccountByNumber(BAS_SIMPLIFIED, "4000")).toBeDefined(); // Inköp
      expect(getAccountByNumber(BAS_SIMPLIFIED, "5010")).toBeDefined(); // Lokalhyra
      expect(getAccountByNumber(BAS_SIMPLIFIED, "7010")).toBeDefined(); // Löner
    });

    it("should include equity accounts for aktiebolag", () => {
      expect(getAccountByNumber(BAS_SIMPLIFIED, "2081")).toBeDefined(); // Aktiekapital
      expect(getAccountByNumber(BAS_SIMPLIFIED, "2091")).toBeDefined(); // Balanserad vinst
      expect(getAccountByNumber(BAS_SIMPLIFIED, "2099")).toBeDefined(); // Årets resultat
    });

    it("should include customer and supplier accounts", () => {
      expect(getAccountByNumber(BAS_SIMPLIFIED, "1510")).toBeDefined(); // Kundfordringar
      expect(getAccountByNumber(BAS_SIMPLIFIED, "2440")).toBeDefined(); // Leverantörsskulder
    });
  });
});

describe("getAccountsByType", () => {
  it("should return only accounts of specified type", () => {
    const assets = getAccountsByType(BAS_SIMPLIFIED, "ASSET");
    expect(assets.length).toBeGreaterThan(0);
    for (const account of assets) {
      expect(account.type).toBe("ASSET");
    }
  });

  it("should return empty array if no accounts match", () => {
    const noMatch = getAccountsByType([], "ASSET");
    expect(noMatch).toEqual([]);
  });
});

describe("getAccountByNumber", () => {
  it("should find account by number", () => {
    const account = getAccountByNumber(BAS_SIMPLIFIED, "1910");
    expect(account).toBeDefined();
    expect(account?.name).toBe("Kassa");
  });

  it("should return undefined for non-existent account", () => {
    const account = getAccountByNumber(BAS_SIMPLIFIED, "9999");
    expect(account).toBeUndefined();
  });
});

describe("getVatAccounts", () => {
  it("should return only VAT accounts", () => {
    const vatAccounts = getVatAccounts(BAS_SIMPLIFIED);
    expect(vatAccounts.length).toBeGreaterThan(0);
    for (const account of vatAccounts) {
      expect(account.isVatAccount).toBe(true);
    }
  });

  it("should not include non-VAT accounts", () => {
    const vatAccounts = getVatAccounts(BAS_SIMPLIFIED);
    const nonVatAccounts = BAS_SIMPLIFIED.filter((a) => !a.isVatAccount);
    
    for (const nonVat of nonVatAccounts) {
      expect(vatAccounts).not.toContain(nonVat);
    }
  });
});
