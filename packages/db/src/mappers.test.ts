import { describe, it, expect } from "vitest";
import {
  toOrganization,
  toFiscalYear,
  toAccount,
  toVoucher,
  toVoucherLine,
  toDocument,
} from "./mappers.js";

// Derive mapper input types — avoids importing Prisma generics directly
type OrgRow = Parameters<typeof toOrganization>[0];
type FyRow = Parameters<typeof toFiscalYear>[0];
type AccountRow = Parameters<typeof toAccount>[0];
type VoucherRow = Parameters<typeof toVoucher>[0];
type LineRow = Parameters<typeof toVoucherLine>[0];
type DocRow = Parameters<typeof toDocument>[0];

// Prisma-like stub data matching the mapper input types
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
    const result = toOrganization(prismaOrg as unknown as OrgRow);
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
    const result = toOrganization(prismaOrg as unknown as OrgRow);
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
    const result = toFiscalYear(prismaFy as unknown as FyRow);
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
    const result = toFiscalYear(closed as unknown as FyRow);
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
    const result = toAccount(prismaAccount as unknown as AccountRow);
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
    const result = toAccount(vatAccount as unknown as AccountRow);
    expect(result.type).toBe("LIABILITY");
    expect(result.isVatAccount).toBe(true);
  });

  it("should handle inactive accounts", () => {
    const inactive = { ...prismaAccount, isActive: false };
    const result = toAccount(inactive as unknown as AccountRow);
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
    const result = toVoucherLine(prismaLine as unknown as LineRow);
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
    const result = toVoucherLine(noDesc as unknown as LineRow);
    expect(result.description).toBeUndefined();
  });

  it("should preserve description when present", () => {
    const result = toVoucherLine(prismaLine as unknown as LineRow);
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
    const result = toVoucher(prismaVoucher as unknown as VoucherRow);
    expect(result.id).toBe("v-1");
    expect(result.number).toBe(1);
    expect(result.description).toBe("Test verifikat");
    expect(result.lines).toHaveLength(2);
    expect(result.documentIds).toEqual(["doc-1", "doc-2"]);
  });

  it("should map nested lines via toVoucherLine", () => {
    const result = toVoucher(prismaVoucher as unknown as VoucherRow);
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
    const result = toVoucher(noDocVoucher as unknown as VoucherRow);
    expect(result.documentIds).toEqual([]);
  });

  it("should handle voucher with empty lines", () => {
    const noLinesVoucher = { ...prismaVoucher, lines: [], documents: [] };
    const result = toVoucher(noLinesVoucher as unknown as VoucherRow);
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
    const result = toDocument(prismaDoc as unknown as DocRow);
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
    const result = toDocument(noVoucher as unknown as DocRow);
    expect(result.voucherId).toBeUndefined();
  });

  it("should preserve voucherId when present", () => {
    const result = toDocument(prismaDoc as unknown as DocRow);
    expect(result.voucherId).toBe("v-1");
  });
});
