import type { CreateInvoiceLineInput, InvoiceLine } from "../types/invoice.js";

/**
 * Calculate the line amount (excl. VAT) from quantity and unit price.
 * quantity is in hundredths (100 = 1.00), unitPrice is in öre.
 * Result is in öre.
 */
export function calculateLineAmount(quantity: number, unitPrice: number): number {
  return Math.round((quantity / 100) * unitPrice);
}

/**
 * Calculate VAT for a line amount given a VAT rate.
 * vatRate is percentage × 100 (e.g. 2500 = 25%).
 */
export function calculateLineVat(amount: number, vatRate: number): number {
  return Math.round((amount * vatRate) / 10000);
}

/**
 * Calculate invoice totals from lines.
 */
export function calculateInvoiceTotals(lines: readonly (CreateInvoiceLineInput | InvoiceLine)[]): {
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
} {
  let subtotal = 0;
  let vatAmount = 0;

  for (const line of lines) {
    const amount = calculateLineAmount(line.quantity, line.unitPrice);
    subtotal += amount;
    vatAmount += calculateLineVat(amount, line.vatRate);
  }

  return {
    subtotal,
    vatAmount,
    totalAmount: subtotal + vatAmount,
  };
}

/**
 * Check if an invoice can transition to the given status.
 */
export function canTransitionTo(currentStatus: string, targetStatus: string): boolean {
  const allowed: Record<string, readonly string[]> = {
    DRAFT: ["SENT", "CANCELLED"],
    SENT: ["PAID", "OVERDUE", "CANCELLED", "CREDITED"],
    OVERDUE: ["PAID", "CANCELLED", "CREDITED"],
    PAID: [],
    CANCELLED: [],
    CREDITED: [],
  };
  return (allowed[currentStatus] ?? []).includes(targetStatus);
}
