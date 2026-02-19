/**
 * Account - ett konto i kontoplanen.
 */

/** Kontotyp baserat på svenska redovisningsregler */
export type AccountType =
  | "ASSET" // Tillgångar (1xxx)
  | "LIABILITY" // Skulder (2xxx utom eget kapital)
  | "EQUITY" // Eget kapital (2xxx eget kapital-konton)
  | "REVENUE" // Intäkter (3xxx)
  | "EXPENSE"; // Kostnader (4xxx-7xxx, 8xxx)

/** Account number validation constants (BAS standard) */
export const ACCOUNT_NUMBER_PATTERN = /^[1-8]\d{3}$/;
export const ACCOUNT_NUMBER_MIN = 1000;
export const ACCOUNT_NUMBER_MAX = 8999;

export interface Account {
  readonly number: string; // 4-siffrig kontokod
  readonly name: string;
  readonly type: AccountType;
  /** Om kontot är ett momskonto */
  readonly isVatAccount: boolean;
  /** Om kontot är aktivt och kan användas */
  readonly isActive: boolean;
}

export interface CreateAccountInput {
  readonly number: string;
  readonly name: string;
  readonly type: AccountType;
  readonly isVatAccount?: boolean;
}

export interface UpdateAccountInput {
  readonly name?: string;
  readonly type?: AccountType;
  readonly isVatAccount?: boolean;
}

export interface AccountError {
  readonly code:
    | "INVALID_NUMBER"
    | "INVALID_NAME"
    | "DUPLICATE_NUMBER"
    | "NOT_FOUND";
  readonly message: string;
}

/** Determine account type from account number (BAS standard) */
export function getAccountTypeFromNumber(accountNumber: string): AccountType {
  const firstDigit = accountNumber.charAt(0);

  switch (firstDigit) {
    case "1":
      return "ASSET";
    case "2": {
      // 20xx (2000-2099) are equity accounts (eget kapital)
      // 21xx-29xx are liabilities
      const num = parseInt(accountNumber, 10);
      if (num >= 2000 && num <= 2099) {
        return "EQUITY";
      }
      return "LIABILITY";
    }
    case "3":
      return "REVENUE";
    case "4":
    case "5":
    case "6":
    case "7":
      return "EXPENSE";
    case "8": {
      // 8xxx are financial items - can be income or expense
      // 8xxx < 8400 typically income, >= 8400 typically expense
      const finNum = parseInt(accountNumber, 10);
      return finNum >= 8400 ? "EXPENSE" : "REVENUE";
    }
    default:
      return "EXPENSE"; // Default fallback
  }
}

/** Validate a 4-digit account number */
export function isValidAccountNumber(accountNumber: string): boolean {
  return /^[1-8]\d{3}$/.test(accountNumber);
}
