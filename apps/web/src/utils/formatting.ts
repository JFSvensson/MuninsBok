/**
 * Formatting utilities for the web application
 */

/**
 * Format a number amount with Swedish locale and 2 decimal places
 */
export function formatAmount(amount: number): string {
  return amount.toLocaleString("sv-SE", { minimumFractionDigits: 2 });
}

/**
 * Format a date with Swedish locale
 */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("sv-SE");
}

/**
 * Get CSS class name for amount coloring based on positive/negative
 */
export function amountClassName(amount: number, includeBase = true): string {
  const baseClass = includeBase ? "text-right amount " : "";
  return `${baseClass}${amount >= 0 ? "positive" : "negative"}`;
}

/**
 * Parse a string amount to ören (Swedish cents)
 * Handles both comma and period as decimal separators
 */
export function parseAmountToOre(value: string): number {
  if (!value || value.trim() === "") return 0;
  
  const normalized = value.replace(",", ".");
  const parsed = parseFloat(normalized);
  
  if (isNaN(parsed)) return 0;
  
  return Math.round(parsed * 100);
}

/**
 * Convert ören to kronor
 */
export function oreToKronor(ore: number): number {
  return ore / 100;
}
