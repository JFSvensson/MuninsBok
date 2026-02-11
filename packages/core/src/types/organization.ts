/**
 * Organization - en förening eller ett företag som bokför.
 */
export interface Organization {
  readonly id: string;
  /** Organisationsnummer (10 siffror, utan bindestreck) */
  readonly orgNumber: string;
  readonly name: string;
  /** Månad då räkenskapsåret börjar (1-12), default 1 för kalenderår */
  readonly fiscalYearStartMonth: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateOrganizationInput {
  readonly orgNumber: string;
  readonly name: string;
  readonly fiscalYearStartMonth?: number;
}

export interface OrganizationError {
  readonly code: "INVALID_ORG_NUMBER" | "INVALID_NAME" | "INVALID_FISCAL_MONTH";
  readonly message: string;
}

/** Validate Swedish organization number (personnummer or organisationsnummer) */
export function isValidOrgNumber(orgNumber: string): boolean {
  // Remove any dashes
  const cleaned = orgNumber.replace(/-/g, "");

  // Must be 10 or 12 digits
  if (!/^\d{10}$/.test(cleaned) && !/^\d{12}$/.test(cleaned)) {
    return false;
  }

  // Luhn algorithm check on last 10 digits
  const digits = cleaned.slice(-10);
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let digit = parseInt(digits[i]!, 10);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  return sum % 10 === 0;
}
