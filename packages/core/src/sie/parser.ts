import type {
  SieFile,
  SieParseError,
  SieFiscalYear,
  SieAccount,
  SieBalance,
  SieVoucher,
  SieTransaction,
} from "./types.js";
import { ok, err, type Result } from "../types/result.js";

/**
 * Parse a SIE file from string content.
 * Handles SIE4 format with vouchers and transactions.
 */
export function parseSie(content: string): Result<SieFile, SieParseError> {
  const lines = content.split(/\r?\n/);

  // Initialize with defaults
  let flag = 0;
  let format = "PC8";
  let sieType = 4;
  let programName = "";
  let programVersion = "";
  let genDate = new Date();
  let genSignature: string | undefined;
  let companyName = "";
  let orgNumber: string | undefined;
  const fiscalYears: SieFiscalYear[] = [];
  const accounts: SieAccount[] = [];
  const openingBalances: SieBalance[] = [];
  const closingBalances: SieBalance[] = [];
  const resultBalances: SieBalance[] = [];
  const vouchers: SieVoucher[] = [];

  let currentVoucher: {
    series: string;
    number: number;
    date: Date;
    description: string;
    transactions: SieTransaction[];
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line || line.startsWith("//")) continue;

    // Parse the line into tokens
    const tokens = parseSieLine(line);
    if (tokens.length === 0) continue;

    const tag = tokens[0]!.toUpperCase();

    try {
      switch (tag) {
        case "#FLAGGA":
          flag = parseInt(tokens[1] ?? "0", 10);
          break;

        case "#FORMAT":
          format = tokens[1] ?? "PC8";
          break;

        case "#SIETYP":
          sieType = parseInt(tokens[1] ?? "4", 10);
          break;

        case "#PROGRAM":
          programName = tokens[1] ?? "";
          programVersion = tokens[2] ?? "";
          break;

        case "#GEN":
          if (tokens[1]) {
            const parsed = parseSieDate(tokens[1]);
            if (parsed) genDate = parsed;
          }
          genSignature = tokens[2];
          break;

        case "#FNAMN":
          companyName = tokens[1] ?? "";
          break;

        case "#ORGNR":
          orgNumber = tokens[1];
          break;

        case "#RAR": {
          const yearIndex = parseInt(tokens[1] ?? "0", 10);
          const startDate = tokens[2] ? parseSieDate(tokens[2]) : null;
          const endDate = tokens[3] ? parseSieDate(tokens[3]) : null;
          if (startDate && endDate) {
            fiscalYears.push({ index: yearIndex, startDate, endDate });
          }
          break;
        }

        case "#KONTO":
          if (tokens[1] && tokens[2]) {
            accounts.push({ number: tokens[1], name: tokens[2] });
          }
          break;

        case "#IB": {
          const balance = parseBalanceLine(tokens, i);
          if (balance) openingBalances.push(balance);
          break;
        }

        case "#UB": {
          const balance = parseBalanceLine(tokens, i);
          if (balance) closingBalances.push(balance);
          break;
        }

        case "#RES": {
          const balance = parseBalanceLine(tokens, i);
          if (balance) resultBalances.push(balance);
          break;
        }

        case "#VER": {
          // Save previous voucher if exists
          if (currentVoucher) {
            vouchers.push({ ...currentVoucher, transactions: [...currentVoucher.transactions] });
          }

          const series = tokens[1] ?? "A";
          const number = parseInt(tokens[2] ?? "0", 10);
          const date = tokens[3] ? parseSieDate(tokens[3]) : new Date();
          const description = tokens[4] ?? "";

          currentVoucher = {
            series,
            number,
            date: date ?? new Date(),
            description,
            transactions: [],
          };
          break;
        }

        case "#TRANS": {
          if (currentVoucher && tokens[1]) {
            const accountNumber = tokens[1];
            const amount = parseFloat((tokens[3] ?? "0").replace(",", "."));
            const transDate = tokens[4] ? parseSieDate(tokens[4]) : undefined;
            const description = tokens[5];

            currentVoucher.transactions.push({
              accountNumber,
              amount: Math.round(amount * 100), // Convert to ören
              date: transDate ?? undefined,
              description,
            });
          }
          break;
        }

        case "}":
          // End of voucher block
          if (currentVoucher) {
            vouchers.push({ ...currentVoucher, transactions: [...currentVoucher.transactions] });
            currentVoucher = null;
          }
          break;
      }
    } catch (e) {
      return err({
        code: "INVALID_FORMAT",
        message: `Failed to parse line ${i + 1}: ${e instanceof Error ? e.message : String(e)}`,
        line: i + 1,
      });
    }
  }

  // Don't forget the last voucher
  if (currentVoucher) {
    vouchers.push({ ...currentVoucher, transactions: [...currentVoucher.transactions] });
  }

  if (!companyName) {
    return err({
      code: "MISSING_REQUIRED_FIELD",
      message: "Missing required field: #FNAMN (company name)",
      field: "FNAMN",
    });
  }

  return ok({
    flag,
    format,
    sieType,
    program: { name: programName, version: programVersion },
    generated: { date: genDate, signature: genSignature },
    companyName,
    orgNumber,
    fiscalYears,
    accounts,
    openingBalances,
    closingBalances,
    resultBalances,
    vouchers,
  });
}

/**
 * Parse a SIE line into tokens, handling quoted strings.
 */
function parseSieLine(line: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === " " && !inQuotes) {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else if (char === "{" && !inQuotes) {
      // Start of block, ignore
    } else if (char === "}" && !inQuotes) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      tokens.push("}");
    } else {
      current += char;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Parse a SIE date (YYYYMMDD) to a Date object.
 */
function parseSieDate(dateStr: string): Date | null {
  if (dateStr.length !== 8) return null;

  const year = parseInt(dateStr.slice(0, 4), 10);
  const month = parseInt(dateStr.slice(4, 6), 10) - 1;
  const day = parseInt(dateStr.slice(6, 8), 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  return new Date(year, month, day);
}

/**
 * Parse a balance line (#IB, #UB, #RES).
 */
function parseBalanceLine(
  tokens: string[],
  _lineNumber: number
): SieBalance | null {
  if (tokens.length < 4) return null;

  const yearIndex = parseInt(tokens[1] ?? "0", 10);
  const accountNumber = tokens[2] ?? "";
  const balance = parseFloat((tokens[3] ?? "0").replace(",", "."));

  if (!accountNumber || isNaN(balance)) return null;

  return {
    yearIndex,
    accountNumber,
    balance: Math.round(balance * 100), // Convert to ören
  };
}
