/**
 * VoucherTemplate - en verifikatmall för återkommande bokföring.
 */

// ── Domain types ────────────────────────────────────────────

export interface VoucherTemplateLine {
  readonly id: string;
  readonly templateId: string;
  readonly accountNumber: string;
  /** Standardbelopp debet i ören (0 om kredit) */
  readonly debit: number;
  /** Standardbelopp kredit i ören (0 om debet) */
  readonly credit: number;
  /** Valfri beskrivning av raden */
  readonly description?: string;
}

export interface VoucherTemplate {
  readonly id: string;
  readonly organizationId: string;
  /** Mallnamn, t.ex. "Månadshyra" eller "Löneutbetalning" */
  readonly name: string;
  /** Valfri beskrivning av mallen */
  readonly description?: string;
  /** Mallrader */
  readonly lines: readonly VoucherTemplateLine[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// ── Input types ─────────────────────────────────────────────

export interface CreateVoucherTemplateLineInput {
  readonly accountNumber: string;
  readonly debit: number;
  readonly credit: number;
  readonly description?: string;
}

export interface CreateVoucherTemplateInput {
  readonly name: string;
  readonly description?: string;
  readonly lines: readonly CreateVoucherTemplateLineInput[];
}

/** Update replaces lines entirely (simpler UX for "easy to edit" requirement). */
export interface UpdateVoucherTemplateInput {
  readonly name?: string;
  readonly description?: string;
  readonly lines?: readonly CreateVoucherTemplateLineInput[];
}

// ── Error types ─────────────────────────────────────────────

export type VoucherTemplateErrorCode =
  | "NOT_FOUND"
  | "DUPLICATE_NAME"
  | "NO_LINES"
  | "INVALID_LINE"
  | "NAME_REQUIRED";

export interface VoucherTemplateError {
  readonly code: VoucherTemplateErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

// ── Validation ──────────────────────────────────────────────

export interface VoucherTemplateLineError {
  readonly code: "INVALID_ACCOUNT" | "NEGATIVE_AMOUNT" | "BOTH_DEBIT_AND_CREDIT" | "ZERO_AMOUNT";
  readonly message: string;
}

/** Validate a single template line. */
export function validateTemplateLine(
  line: CreateVoucherTemplateLineInput,
): VoucherTemplateLineError | null {
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

/** Validate an entire template create input. Returns null if valid. */
export function validateVoucherTemplate(
  input: CreateVoucherTemplateInput,
): VoucherTemplateError | null {
  if (!input.name || input.name.trim().length === 0) {
    return { code: "NAME_REQUIRED", message: "Mallnamn krävs" };
  }

  if (!input.lines || input.lines.length === 0) {
    return { code: "NO_LINES", message: "Mallen måste ha minst en rad" };
  }

  for (const line of input.lines) {
    const lineError = validateTemplateLine(line);
    if (lineError) {
      return {
        code: "INVALID_LINE",
        message: lineError.message,
        details: lineError,
      };
    }
  }

  return null;
}
