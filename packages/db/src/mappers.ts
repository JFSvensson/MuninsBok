import type { Prisma } from "./generated/prisma/client.js";
import type {
  Organization as CoreOrganization,
  FiscalYear as CoreFiscalYear,
  Account as CoreAccount,
  Voucher as CoreVoucher,
  VoucherLine as CoreVoucherLine,
  Document as CoreDocument,
  AccountType,
  User as CoreUser,
  SafeUser as CoreSafeUser,
  MemberRole as CoreMemberRole,
  OrganizationMember as CoreOrganizationMember,
  OrganizationMemberWithUser as CoreOrganizationMemberWithUser,
} from "@muninsbok/core/types";

/**
 * Map Prisma Organization to Core Organization
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
export function toOrganization(org: Prisma.OrganizationGetPayload<{}>): CoreOrganization {
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
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
export function toFiscalYear(fy: Prisma.FiscalYearGetPayload<{}>): CoreFiscalYear {
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
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
export function toAccount(account: Prisma.AccountGetPayload<{}>): CoreAccount {
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
  }>,
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
    ...(voucher.correctedByVoucher != null && {
      correctedByVoucherId: voucher.correctedByVoucher.id,
    }),
    createdAt: voucher.createdAt,
    updatedAt: voucher.updatedAt,
  };
}

/**
 * Map Prisma VoucherLine to Core VoucherLine
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
export function toVoucherLine(line: Prisma.VoucherLineGetPayload<{}>): CoreVoucherLine {
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
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
export function toDocument(doc: Prisma.DocumentGetPayload<{}>): CoreDocument {
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

/**
 * Map Prisma User to Core User
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
export function toUser(user: Prisma.UserGetPayload<{}>): CoreUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    passwordHash: user.passwordHash,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Map Prisma User to Core SafeUser (no passwordHash)
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
export function toSafeUser(user: Prisma.UserGetPayload<{}>): CoreSafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Map Prisma OrganizationMember to Core OrganizationMember
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Prisma GetPayload generic
export function toOrganizationMember(
  member: Prisma.OrganizationMemberGetPayload<{}>,
): CoreOrganizationMember {
  return {
    id: member.id,
    userId: member.userId,
    organizationId: member.organizationId,
    role: member.role as CoreMemberRole,
    createdAt: member.createdAt,
  };
}

/**
 * Map Prisma OrganizationMember (with user) to Core OrganizationMemberWithUser
 */
export function toOrganizationMemberWithUser(
  member: Prisma.OrganizationMemberGetPayload<{ include: { user: true } }>,
): CoreOrganizationMemberWithUser {
  return {
    id: member.id,
    userId: member.userId,
    organizationId: member.organizationId,
    role: member.role as CoreMemberRole,
    createdAt: member.createdAt,
    user: toSafeUser(member.user),
  };
}
