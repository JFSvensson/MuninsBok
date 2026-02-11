/**
 * FiscalYear - räkenskapsår för en organisation.
 */
export interface FiscalYear {
  readonly id: string;
  readonly organizationId: string;
  readonly startDate: Date;
  readonly endDate: Date;
  /** Om året är stängt för ändringar */
  readonly isClosed: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateFiscalYearInput {
  readonly organizationId: string;
  readonly startDate: Date;
  readonly endDate: Date;
}

export interface FiscalYearError {
  readonly code:
    | "INVALID_DATE_RANGE"
    | "OVERLAPPING_YEAR"
    | "YEAR_CLOSED"
    | "NOT_FOUND";
  readonly message: string;
}

/** Check if a date falls within the fiscal year */
export function isDateInFiscalYear(date: Date, fiscalYear: FiscalYear): boolean {
  const d = date.getTime();
  return d >= fiscalYear.startDate.getTime() && d <= fiscalYear.endDate.getTime();
}

/** Calculate fiscal year from start month and a given year */
export function calculateFiscalYearDates(
  year: number,
  startMonth: number
): { startDate: Date; endDate: Date } {
  // If fiscal year starts in January (month 1), it's a calendar year
  if (startMonth === 1) {
    return {
      startDate: new Date(year, 0, 1),
      endDate: new Date(year, 11, 31),
    };
  }

  // Otherwise, fiscal year spans two calendar years
  // e.g., startMonth=7 means July year to June year+1
  return {
    startDate: new Date(year, startMonth - 1, 1),
    endDate: new Date(year + 1, startMonth - 2 + 1, 0), // Last day of month before startMonth
  };
}
