import { describe, it, expect } from "vitest";
import {
  toOrganization,
  toFiscalYear,
  toAccount,
  toVoucher,
  toVoucherLine,
  toDocument,
} from "./mappers.js";

// Prisma-like stub data matching Prisma.XxxGetPayload<{}>
// These mirror what Prisma would actually return (plain objects with Date fields)

const now = new Date("2025-06-15T12:00:00Z");

describe("toOrganization", () => {
  const prismaOrg = {
    id: "org-1",
    orgNumber: "5560360793",
    name: "Testföretag AB",
    fiscalYearStartMonth: 1,
    createdAt: now,
    updatedAt: now,
  };

  it("should map all fields correctly", () => {
    const result = toOrganization(prismaOrg as any);
    expect(result).toEqual({
      id: "org-1",
      orgNumber: "5560360793",
      name: "Testföretag AB",
      fiscalYearStartMonth: 1,
      createdAt: now,
      updatedAt: now,
    });
  });

  it("should preserve date types", () => {
    const result = toOrganization(prismaOrg as any);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });
});

describe("toFiscalYear", () => {
  const prismaFy = {
    id: "fy-1",
    organizationId: "org-1",
    startDate: new Date("2025-01-01"),
    endDate: new Date("2025-12-31"),
    isClosed: false,
    createdAt: now,
    updatedAt: now,
  };

  it("should map all fields correctly", () => {
    const result = toFiscalYear(prismaFy as any);
    expect(result).toEqual({
      id: "fy-1",
      organizationId: "org-1",
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-12-31"),
      isClosed: false,
      createdAt: now,
      updatedAt: now,
    });
  });

  it("should handle closed fiscal year", () => {
    const closed = { ...prismaFy, isClosed: true };
    const result = toFiscalYear(closed as any);
    expect(result.isClosed).toBe(true);
  });
});

describe("toAccount", () => {
  const prismaAccount = {
    id: "acc-1",
    organizationId: "org-1",
    number: "1910",
    name: "Kassa",
    type: "ASSET",
    isVatAccount: false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  it("should map core fields (excludes id and organizationId)", () => {
    const result = toAccount(prismaAccount as any);
    expect(result).toEqual({
      number: "1910",
      name: "Kassa",
      type: "ASSET",
      isVatAccount: false,
      isActive: true,
    });
  });

  it("should cast type string to AccountType", () => {
    const vatAccount = {
      ...prismaAccount,
      type: "LIABILITY",
      isVatAccount: true,
      number: "2610",
      name: "Utgående moms 25%",
    };
    const result = toAccount(vatAccount as any);
    expect(result.type).toBe("LIABILITY");
    expect(result.isVatAccount).toBe(true);
  });

  it("should handle inactive accounts", () => {
    const inactive = { ...prismaAccount, isActive: false };
    const result = toAccount(inactive as any);
    expect(result.isActive).toBe(false);
  });
});

describe("toVoucherLine", () => {
  const prismaLine = {
    id: "line-1",
    voucherId: "v-1",
    accountId: "acc-1",
    accountNumber: "1910",
    debit: 10000,
    credit: 0,
    description: "Kontantförsäljning",
    createdAt: now,
  };

  it("should map all fields correctly", () => {
    const result = toVoucherLine(prismaLine as any);
    expect(result).toEqual({
      id: "line-1",
      voucherId: "v-1",
      accountNumber: "1910",
      debit: 10000,
      credit: 0,
      description: "Kontantförsäljning",
    });
  });

  it("should convert null description to undefined", () => {
    const noDesc = { ...prismaLine, description: null };
    const result = toVoucherLine(noDesc as any);
    expect(result.description).toBeUndefined();
  });

  it("should preserve description when present", () => {
    const result = toVoucherLine(prismaLine as any);
    expect(result.description).toBe("Kontantförsäljning");
  });
});

describe("toVoucher", () => {
  const prismaVoucher = {
    id: "v-1",
    fiscalYearId: "fy-1",
    organizationId: "org-1",
    number: 1,
    date: new Date("2025-03-15"),
    description: "Test verifikat",
    lines: [
      {
        id: "line-1",
        voucherId: "v-1",
        accountId: "acc-1",
        accountNumber: "1910",
        debit: 10000,
        credit: 0,
        description: null,
        createdAt: now,
      },
      {
        id: "line-2",
        voucherId: "v-1",
        accountId: "acc-2",
        accountNumber: "3000",
        debit: 0,
        credit: 10000,
        description: null,
        createdAt: now,
      },
    ],
    documents: [{ id: "doc-1" }, { id: "doc-2" }],
    createdAt: now,
    updatedAt: now,
  };

  it("should map voucher with lines and document IDs", () => {
    const result = toVoucher(prismaVoucher as any);
    expect(result.id).toBe("v-1");
    expect(result.number).toBe(1);
    expect(result.description).toBe("Test verifikat");
    expect(result.lines).toHaveLength(2);
    expect(result.documentIds).toEqual(["doc-1", "doc-2"]);
  });

  it("should map nested lines via toVoucherLine", () => {
    const result = toVoucher(prismaVoucher as any);
    expect(result.lines[0]).toEqual({
      id: "line-1",
      voucherId: "v-1",
      accountNumber: "1910",
      debit: 10000,
      credit: 0,
      description: undefined,
    });
  });

  it("should handle voucher with no documents", () => {
    const noDocVoucher = { ...prismaVoucher, documents: [] };
    const result = toVoucher(noDocVoucher as any);
    expect(result.documentIds).toEqual([]);
  });

  it("should handle voucher with empty lines", () => {
    const noLinesVoucher = { ...prismaVoucher, lines: [], documents: [] };
    const result = toVoucher(noLinesVoucher as any);
    expect(result.lines).toEqual([]);
  });
});

describe("toDocument", () => {
  const prismaDoc = {
    id: "doc-1",
    organizationId: "org-1",
    voucherId: "v-1",
    filename: "kvitto.pdf",
    mimeType: "application/pdf",
    storageKey: "uploads/org-1/kvitto.pdf",
    size: 204800,
    createdAt: now,
    updatedAt: now,
  };

  it("should map all fields correctly", () => {
    const result = toDocument(prismaDoc as any);
    expect(result).toEqual({
      id: "doc-1",
      organizationId: "org-1",
      voucherId: "v-1",
      filename: "kvitto.pdf",
      mimeType: "application/pdf",
      storageKey: "uploads/org-1/kvitto.pdf",
      size: 204800,
      createdAt: now,
    });
  });

  it("should convert null voucherId to undefined", () => {
    const noVoucher = { ...prismaDoc, voucherId: null };
    const result = toDocument(noVoucher as any);
    expect(result.voucherId).toBeUndefined();
  });

  it("should preserve voucherId when present", () => {
    const result = toDocument(prismaDoc as any);
    expect(result.voucherId).toBe("v-1");
  });
});
