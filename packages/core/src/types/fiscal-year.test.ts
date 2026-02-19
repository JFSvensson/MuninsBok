import { describe, it, expect } from "vitest";
import { isDateInFiscalYear, calculateFiscalYearDates } from "./fiscal-year.js";
import type { FiscalYear } from "./fiscal-year.js";

function makeFiscalYear(start: string, end: string, overrides?: Partial<FiscalYear>): FiscalYear {
  return {
    id: "fy-test",
    organizationId: "org-test",
    startDate: new Date(start),
    endDate: new Date(end),
    isClosed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("isDateInFiscalYear", () => {
  const calendarYear = makeFiscalYear("2025-01-01", "2025-12-31");

  describe("calendar year (January–December)", () => {
    it("should return true for date within year", () => {
      expect(isDateInFiscalYear(new Date("2025-06-15"), calendarYear)).toBe(true);
    });

    it("should return true for first day of year", () => {
      expect(isDateInFiscalYear(new Date("2025-01-01"), calendarYear)).toBe(true);
    });

    it("should return true for last day of year", () => {
      expect(isDateInFiscalYear(new Date("2025-12-31"), calendarYear)).toBe(true);
    });

    it("should return false for date before year", () => {
      expect(isDateInFiscalYear(new Date("2024-12-31"), calendarYear)).toBe(false);
    });

    it("should return false for date after year", () => {
      expect(isDateInFiscalYear(new Date("2026-01-01"), calendarYear)).toBe(false);
    });
  });

  describe("broken fiscal year (e.g. July–June)", () => {
    const brokenYear = makeFiscalYear("2025-07-01", "2026-06-30");

    it("should return true for date in first half (fall)", () => {
      expect(isDateInFiscalYear(new Date("2025-09-15"), brokenYear)).toBe(true);
    });

    it("should return true for date in second half (spring)", () => {
      expect(isDateInFiscalYear(new Date("2026-03-01"), brokenYear)).toBe(true);
    });

    it("should return false for date before start", () => {
      expect(isDateInFiscalYear(new Date("2025-06-30"), brokenYear)).toBe(false);
    });

    it("should return false for date after end", () => {
      expect(isDateInFiscalYear(new Date("2026-07-01"), brokenYear)).toBe(false);
    });
  });
});

describe("calculateFiscalYearDates", () => {
  describe("calendar year (startMonth = 1)", () => {
    it("should return January 1 – December 31", () => {
      const { startDate, endDate } = calculateFiscalYearDates(2025, 1);
      expect(startDate.getFullYear()).toBe(2025);
      expect(startDate.getMonth()).toBe(0); // January
      expect(startDate.getDate()).toBe(1);
      expect(endDate.getFullYear()).toBe(2025);
      expect(endDate.getMonth()).toBe(11); // December
      expect(endDate.getDate()).toBe(31);
    });

    it("should handle leap year", () => {
      const { startDate, endDate } = calculateFiscalYearDates(2024, 1);
      expect(startDate).toEqual(new Date(2024, 0, 1));
      expect(endDate).toEqual(new Date(2024, 11, 31));
    });
  });

  describe("broken fiscal year (startMonth > 1)", () => {
    it("should return July 1 – June 30 for startMonth = 7", () => {
      const { startDate, endDate } = calculateFiscalYearDates(2025, 7);
      expect(startDate.getFullYear()).toBe(2025);
      expect(startDate.getMonth()).toBe(6); // July
      expect(startDate.getDate()).toBe(1);
      expect(endDate.getFullYear()).toBe(2026);
      expect(endDate.getMonth()).toBe(5); // June
      expect(endDate.getDate()).toBe(30);
    });

    it("should return May 1 – April 30 for startMonth = 5", () => {
      const { startDate, endDate } = calculateFiscalYearDates(2025, 5);
      expect(startDate.getMonth()).toBe(4); // May
      expect(startDate.getDate()).toBe(1);
      expect(endDate.getFullYear()).toBe(2026);
      expect(endDate.getMonth()).toBe(3); // April
      expect(endDate.getDate()).toBe(30);
    });

    it("should return September 1 – August 31 for startMonth = 9", () => {
      const { startDate, endDate } = calculateFiscalYearDates(2025, 9);
      expect(startDate.getMonth()).toBe(8); // September
      expect(startDate.getDate()).toBe(1);
      expect(endDate.getMonth()).toBe(7); // August
      expect(endDate.getDate()).toBe(31);
    });

    it("should handle February end correctly (non-leap)", () => {
      // startMonth = 3 → March 1 – last day of February = 28
      const { endDate } = calculateFiscalYearDates(2025, 3);
      expect(endDate.getMonth()).toBe(1); // February
      expect(endDate.getDate()).toBe(28);
    });

    it("should handle February end correctly (leap year)", () => {
      // startMonth = 3, year = 2023 → March 2023 – February 2024 (leap)
      const { endDate } = calculateFiscalYearDates(2023, 3);
      expect(endDate.getMonth()).toBe(1); // February
      expect(endDate.getDate()).toBe(29);
    });
  });
});
