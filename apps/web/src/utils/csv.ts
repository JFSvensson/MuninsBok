/**
 * CSV export utility for reports
 */

/**
 * Convert rows and headers to a CSV string with BOM for Excel compatibility
 */
export function toCsv(
  headers: string[],
  rows: string[][]
): string {
  const BOM = "\uFEFF"; // Excel needs BOM for UTF-8
  const escape = (val: string) => {
    if (val.includes('"') || val.includes(";") || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines = [
    headers.map(escape).join(";"),
    ...rows.map((row) => row.map(escape).join(";")),
  ];

  return BOM + lines.join("\r\n");
}

/**
 * Trigger a file download of a CSV string
 */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Format a number for CSV (Swedish decimal comma)
 */
export function csvAmount(amount: number): string {
  return amount.toFixed(2).replace(".", ",");
}
