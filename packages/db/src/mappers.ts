import type { Prisma } from "./generated/prisma/client.js";
import type {
  Organization as CoreOrganization,
  FiscalYear as CoreFiscalYear,
  Account as CoreAccount,
  Voucher as CoreVoucher,
  VoucherLine as CoreVoucherLine,
  Document as CoreDocument,
  AccountType,
} from "@muninsbok/core";

/**
 * Map Prisma Organization to Core Organization
 */
export function toOrganization(
  org: Prisma.OrganizationGetPayload<{}>
): CoreOrganization {
  return {
    id: org.id,
    orgNumber: org.orgNumber,
    name: org.name,
    fiscalYearStartMonth: org.fiscalYearStartMonth,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
}

/**
 * Map Prisma FiscalYear to Core FiscalYear
 */
export function toFiscalYear(
  fy: Prisma.FiscalYearGetPayload<{}>
): CoreFiscalYear {
  return {
    id: fy.id,
    organizationId: fy.organizationId,
    startDate: fy.startDate,
    endDate: fy.endDate,
    isClosed: fy.isClosed,
    createdAt: fy.createdAt,
    updatedAt: fy.updatedAt,
  };
}

/**
 * Map Prisma Account to Core Account
 */
export function toAccount(
  account: Prisma.AccountGetPayload<{}>
): CoreAccount {
  return {
    number: account.number,
    name: account.name,
    type: account.type as AccountType,
    isVatAccount: account.isVatAccount,
    isActive: account.isActive,
  };
}

/**
 * Map Prisma Voucher with lines to Core Voucher
 */
export function toVoucher(
  voucher: Prisma.VoucherGetPayload<{
    include: { lines: true; documents: true; correctedByVoucher: true };
  }>
): CoreVoucher {
  return {
    id: voucher.id,
    fiscalYearId: voucher.fiscalYearId,
    organizationId: voucher.organizationId,
    number: voucher.number,
    date: voucher.date,
    description: voucher.description,
    lines: voucher.lines.map(toVoucherLine),
    documentIds: voucher.documents.map((d) => d.id),
    ...(voucher.createdBy != null && { createdBy: voucher.createdBy }),
    ...(voucher.correctsVoucherId != null && { correctsVoucherId: voucher.correctsVoucherId }),
    ...(voucher.correctedByVoucher != null && { correctedByVoucherId: voucher.correctedByVoucher.id }),
    createdAt: voucher.createdAt,
    updatedAt: voucher.updatedAt,
  };
}

/**
 * Map Prisma VoucherLine to Core VoucherLine
 */
export function toVoucherLine(
  line: Prisma.VoucherLineGetPayload<{}>
): CoreVoucherLine {
  return {
    id: line.id,
    voucherId: line.voucherId,
    accountNumber: line.accountNumber,
    debit: line.debit,
    credit: line.credit,
    ...(line.description != null && { description: line.description }),
  };
}

/**
 * Map Prisma Document to Core Document
 */
export function toDocument(
  doc: Prisma.DocumentGetPayload<{}>
): CoreDocument {
  return {
    id: doc.id,
    organizationId: doc.organizationId,
    ...(doc.voucherId != null && { voucherId: doc.voucherId }),
    filename: doc.filename,
    mimeType: doc.mimeType,
    storageKey: doc.storageKey,
    size: doc.size,
    createdAt: doc.createdAt,
  };
}
