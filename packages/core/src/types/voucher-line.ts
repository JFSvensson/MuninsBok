/**
 * VoucherLine - en rad i ett verifikat.
 */
export interface VoucherLine {
  readonly id: string;
  readonly voucherId: string;
  readonly accountNumber: string;
  /** Debetbelopp i ören (cents), 0 om kredit */
  readonly debit: number;
  /** Kreditbelopp i ören (cents), 0 om debet */
  readonly credit: number;
  /** Valfri beskrivning av raden */
  readonly description?: string;
}

export interface CreateVoucherLineInput {
  readonly accountNumber: string;
  readonly debit: number;
  readonly credit: number;
  readonly description?: string;
}

export interface VoucherLineError {
  readonly code: "INVALID_ACCOUNT" | "NEGATIVE_AMOUNT" | "BOTH_DEBIT_AND_CREDIT" | "ZERO_AMOUNT";
  readonly message: string;
}

/** Validate a voucher line */
export function validateVoucherLine(line: CreateVoucherLineInput): VoucherLineError | null {
  if (line.debit < 0) {
    return { code: "NEGATIVE_AMOUNT", message: "Debet kan inte vara negativt" };
  }

  if (line.credit < 0) {
    return { code: "NEGATIVE_AMOUNT", message: "Kredit kan inte vara negativt" };
  }

  if (line.debit > 0 && line.credit > 0) {
    return {
      code: "BOTH_DEBIT_AND_CREDIT",
      message: "En rad kan inte ha både debet och kredit",
    };
  }

  if (line.debit === 0 && line.credit === 0) {
    return { code: "ZERO_AMOUNT", message: "Belopp måste vara större än 0" };
  }

  return null;
}
