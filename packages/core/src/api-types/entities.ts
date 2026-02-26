/**
 * API contract types for entity resources.
 *
 * These represent the JSON shapes returned by the API — dates are ISO 8601
 * strings and amounts follow the unit documented per field.
 */

export interface Organization {
  id: string;
  orgNumber: string;
  name: string;
  fiscalYearStartMonth: number;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalYear {
  id: string;
  organizationId: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  number: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  isVatAccount: boolean;
  isActive: boolean;
}

export interface VoucherLine {
  id: string;
  voucherId: string;
  accountNumber: string;
  /** Amount in öre (cents) */
  debit: number;
  /** Amount in öre (cents) */
  credit: number;
  description?: string;
}

export interface Voucher {
  id: string;
  fiscalYearId: string;
  organizationId: string;
  number: number;
  date: string;
  description: string;
  lines: VoucherLine[];
  documentIds: string[];
  createdBy?: string;
  correctsVoucherId?: string;
  correctedByVoucherId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentMeta {
  id: string;
  organizationId: string;
  voucherId?: string;
  filename: string;
  mimeType: string;
  storageKey: string;
  size: number;
  createdAt: string;
}

export type MemberRole = "OWNER" | "ADMIN" | "MEMBER";

export interface OrgMember {
  id: string;
  userId: string;
  organizationId: string;
  role: MemberRole;
  createdAt: string;
}

export interface OrgMemberWithUser extends OrgMember {
  user: {
    id: string;
    email: string;
    name: string;
  };
}
