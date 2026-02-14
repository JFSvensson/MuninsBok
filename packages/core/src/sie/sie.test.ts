import { describe, it, expect } from "vitest";
import { parseSie } from "./parser.js";
import { exportSie } from "./exporter.js";
import type { Voucher } from "../types/voucher.js";
import type { Account } from "../types/account.js";
import type { FiscalYear } from "../types/fiscal-year.js";

describe("parseSie", () => {
  it("should parse a minimal SIE file", () => {
    const content = `
#FLAGGA 0
#FORMAT PC8
#SIETYP 4
#PROGRAM "Test" "1.0"
#GEN 20250115
#FNAMN "Testförening"
#ORGNR 1234567890
`;

    const result = parseSie(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.companyName).toBe("Testförening");
      expect(result.value.orgNumber).toBe("1234567890");
      expect(result.value.sieType).toBe(4);
    }
  });

  it("should parse accounts", () => {
    const content = `
#FLAGGA 0
#FORMAT PC8
#SIETYP 4
#FNAMN "Test"
#KONTO 1910 "Kassa"
#KONTO 3000 "Försäljning"
`;

    const result = parseSie(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.accounts).toHaveLength(2);
      expect(result.value.accounts[0]?.number).toBe("1910");
      expect(result.value.accounts[0]?.name).toBe("Kassa");
    }
  });

  it("should parse vouchers with transactions", () => {
    const content = `
#FLAGGA 0
#FORMAT PC8
#SIETYP 4
#FNAMN "Test"
#VER "A" 1 20250115 "Kontantförsäljning"
{
#TRANS 1910 {} 100,00
#TRANS 3000 {} -100,00
}
`;

    const result = parseSie(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.vouchers).toHaveLength(1);
      expect(result.value.vouchers[0]?.number).toBe(1);
      expect(result.value.vouchers[0]?.transactions).toHaveLength(2);
      expect(result.value.vouchers[0]?.transactions[0]?.amount).toBe(10000); // In ören
      expect(result.value.vouchers[0]?.transactions[1]?.amount).toBe(-10000);
    }
  });

  it("should reject file without company name", () => {
    const content = `
#FLAGGA 0
#FORMAT PC8
`;

    const result = parseSie(content);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MISSING_REQUIRED_FIELD");
    }
  });
});

describe("exportSie", () => {
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
    { number: "3000", name: "Försäljning", type: "REVENUE", isVatAccount: false, isActive: true },
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
        { id: "l1", voucherId: "v1", accountNumber: "1910", debit: 10000, credit: 0 },
        { id: "l2", voucherId: "v1", accountNumber: "3000", debit: 0, credit: 10000 },
      ],
      documentIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  it("should export a valid SIE file", () => {
    const result = exportSie({
      companyName: "Testförening",
      orgNumber: "1234567890",
      fiscalYear,
      accounts,
      vouchers,
    });

    expect(result).toContain('#FNAMN "Testförening"');
    expect(result).toContain("#ORGNR 1234567890");
    expect(result).toContain("#KONTO 1910");
    expect(result).toContain("#VER");
    expect(result).toContain("#TRANS 1910");
  });

  it("should roundtrip parse exported SIE", () => {
    const exported = exportSie({
      companyName: "Testförening",
      fiscalYear,
      accounts,
      vouchers,
    });

    const parsed = parseSie(exported);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.companyName).toBe("Testförening");
      expect(parsed.value.accounts).toHaveLength(2);
      expect(parsed.value.vouchers).toHaveLength(1);
    }
  });

  it("should include opening balances (#IB)", () => {
    const ib = new Map<string, number>();
    ib.set("1910", 50000); // 500 kr

    const result = exportSie({
      companyName: "Testförening",
      fiscalYear,
      accounts,
      vouchers,
      openingBalances: ib,
    });

    expect(result).toContain("#IB 0 1910 500,00");
  });

  it("should include closing balances (#UB)", () => {
    const ub = new Map<string, number>();
    ub.set("1910", 60000); // 600 kr

    const result = exportSie({
      companyName: "Testförening",
      fiscalYear,
      accounts,
      vouchers,
      closingBalances: ub,
    });

    expect(result).toContain("#UB 0 1910 600,00");
  });

  it("should include result balances (#RES)", () => {
    const res = new Map<string, number>();
    res.set("3000", -10000); // -100 kr (revenue is credit = negative)

    const result = exportSie({
      companyName: "Testförening",
      fiscalYear,
      accounts,
      vouchers,
      resultBalances: res,
    });

    expect(result).toContain("#RES 0 3000 -100,00");
  });

  it("should skip zero balances in IB/UB/RES", () => {
    const ib = new Map<string, number>();
    ib.set("1910", 0);
    const ub = new Map<string, number>();
    ub.set("1910", 0);
    const res = new Map<string, number>();
    res.set("3000", 0);

    const result = exportSie({
      companyName: "Testförening",
      fiscalYear,
      accounts,
      vouchers,
      openingBalances: ib,
      closingBalances: ub,
      resultBalances: res,
    });

    expect(result).not.toContain("#IB");
    expect(result).not.toContain("#UB");
    expect(result).not.toContain("#RES");
  });
});
