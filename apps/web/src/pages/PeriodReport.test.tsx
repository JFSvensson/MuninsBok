import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetPeriodReport } = vi.hoisted(() => ({
  mockGetPeriodReport: vi.fn(),
}));

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1", name: "Test AB" },
    fiscalYear: { id: "fy-1", startDate: "2024-01-01", endDate: "2024-12-31" },
  }),
}));

vi.mock("../utils/csv", () => ({
  toCsv: vi.fn(() => ""),
  downloadCsv: vi.fn(),
  csvAmount: vi.fn((v: number) => String(v)),
}));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: {
      ...actual.api,
      getPeriodReport: mockGetPeriodReport,
    },
  };
});

import { PeriodReport } from "./PeriodReport";

const sampleReport = {
  data: {
    periodType: "month",
    totalIncome: 5000000,
    totalExpenses: 3000000,
    totalResult: 2000000,
    periods: [
      {
        label: "Jan 2024",
        startDate: "2024-01-01",
        endDate: "2024-01-31",
        income: 2500000,
        expenses: 1500000,
        result: 1000000,
        cumulativeResult: 1000000,
      },
      {
        label: "Feb 2024",
        startDate: "2024-02-01",
        endDate: "2024-02-29",
        income: 2500000,
        expenses: 1500000,
        result: 1000000,
        cumulativeResult: 2000000,
      },
    ],
  },
};

describe("PeriodReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGetPeriodReport.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<PeriodReport />);
    expect(screen.getByText("Laddar periodrapport...")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockGetPeriodReport.mockRejectedValue(new Error("Nätverksfel"));
    renderWithProviders(<PeriodReport />);
    expect(await screen.findByText(/Nätverksfel/)).toBeInTheDocument();
  });

  it("shows empty state when no periods", async () => {
    mockGetPeriodReport.mockResolvedValue({
      data: { periodType: "month", totalIncome: 0, totalExpenses: 0, totalResult: 0, periods: [] },
    });
    renderWithProviders(<PeriodReport />);
    expect(await screen.findByText("Inga bokförda transaktioner ännu.")).toBeInTheDocument();
  });

  it("renders heading", async () => {
    mockGetPeriodReport.mockResolvedValue(sampleReport);
    renderWithProviders(<PeriodReport />);
    expect(
      await screen.findByRole("heading", { level: 2, name: "Periodrapport" }),
    ).toBeInTheDocument();
  });

  it("renders period type buttons", async () => {
    mockGetPeriodReport.mockResolvedValue(sampleReport);
    renderWithProviders(<PeriodReport />);
    await screen.findByText("Totala intäkter");
    expect(screen.getByRole("button", { name: "Månad" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kvartal" })).toBeInTheDocument();
  });

  it("renders summary cards", async () => {
    mockGetPeriodReport.mockResolvedValue(sampleReport);
    renderWithProviders(<PeriodReport />);
    expect(await screen.findByText("Totala intäkter")).toBeInTheDocument();
    expect(screen.getByText("Totala kostnader")).toBeInTheDocument();
  });

  it("renders period data in table", async () => {
    mockGetPeriodReport.mockResolvedValue(sampleReport);
    renderWithProviders(<PeriodReport />);
    await screen.findByText("Totala intäkter");
    // Period labels appear in both main table and comparison table
    expect(screen.getAllByText("Jan 2024").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Feb 2024").length).toBeGreaterThanOrEqual(2);
  });
});
