import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/test-utils";

const { mockNavigate, mockGetDashboard } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGetDashboard: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1" },
    fiscalYear: { id: "fy-1" },
  }),
}));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: { ...actual.api, getDashboard: mockGetDashboard },
  };
});

import { Dashboard } from "./Dashboard";

const baseDashboard = {
  voucherCount: 42,
  accountCount: 15,
  netResult: 12500,
  totalDebit: 100000,
  totalCredit: 100000,
  isBalanced: true,
  latestVouchers: [
    { id: "v-1", number: 1, date: "2026-01-15", description: "Hyra", amount: 8000 },
    { id: "v-2", number: 2, date: "2026-02-01", description: "Lön", amount: 25000 },
  ],
  accountTypeCounts: { ASSET: 5, LIABILITY: 3, EQUITY: 2, REVENUE: 3, EXPENSE: 2 },
  monthlyTrend: [
    { month: "2026-01", voucherCount: 10, income: 50000, expense: 40000 },
    { month: "2026-02", voucherCount: 12, income: 60000, expense: 45000 },
  ],
  generatedAt: "2026-03-26T12:00:00Z",
  yearComparison: [],
  previousYearResult: null,
  forecast: null,
};

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    mockGetDashboard.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProviders(<Dashboard />);
    expect(screen.getByText("Laddar översikt...")).toBeInTheDocument();
  });

  it("renders KPI cards with data", async () => {
    mockGetDashboard.mockResolvedValue({ data: baseDashboard });
    renderWithProviders(<Dashboard />);

    expect(await screen.findByText("42")).toBeInTheDocument(); // voucher count
    expect(screen.getByText("15")).toBeInTheDocument(); // account count
    expect(screen.getByText("✓ OK")).toBeInTheDocument(); // balanced
  });

  it("shows unbalanced indicator when not balanced", async () => {
    mockGetDashboard.mockResolvedValue({
      data: { ...baseDashboard, isBalanced: false },
    });
    renderWithProviders(<Dashboard />);

    expect(await screen.findByText("✗ Obalans")).toBeInTheDocument();
  });

  it("renders latest vouchers table", async () => {
    mockGetDashboard.mockResolvedValue({ data: baseDashboard });
    renderWithProviders(<Dashboard />);

    expect(await screen.findByText("Hyra")).toBeInTheDocument();
    expect(screen.getByText("Lön")).toBeInTheDocument();
  });

  it("navigates to voucher detail on row click", async () => {
    mockGetDashboard.mockResolvedValue({ data: baseDashboard });
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    const row = await screen.findByText("Hyra");
    await user.click(row.closest("tr")!);

    expect(mockNavigate).toHaveBeenCalledWith("/vouchers/v-1");
  });

  it("renders quick link buttons", async () => {
    mockGetDashboard.mockResolvedValue({ data: baseDashboard });
    renderWithProviders(<Dashboard />);

    expect(await screen.findByText("+ Nytt verifikat")).toBeInTheDocument();
    expect(screen.getByText("Alla verifikat")).toBeInTheDocument();
    expect(screen.getByText("Råbalans")).toBeInTheDocument();
  });

  it("navigates to new voucher via quick link", async () => {
    mockGetDashboard.mockResolvedValue({ data: baseDashboard });
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    await user.click(await screen.findByText("+ Nytt verifikat"));
    expect(mockNavigate).toHaveBeenCalledWith("/vouchers/new");
  });

  it("renders monthly trend chart", async () => {
    mockGetDashboard.mockResolvedValue({ data: baseDashboard });
    renderWithProviders(<Dashboard />);

    expect(await screen.findByText("Månadsöversikt")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Stapeldiagram med intäkter och kostnader per månad"),
    ).toBeInTheDocument();
  });

  it("renders account distribution section", async () => {
    mockGetDashboard.mockResolvedValue({ data: baseDashboard });
    renderWithProviders(<Dashboard />);

    expect(await screen.findByText("Kontofördelning")).toBeInTheDocument();
    expect(screen.getByText("Tillgångar")).toBeInTheDocument();
  });

  it("shows error state on failed fetch", async () => {
    mockGetDashboard.mockRejectedValue(new Error("Network error"));
    renderWithProviders(<Dashboard />);

    expect(await screen.findByText(/Fel vid hämtning/)).toBeInTheDocument();
  });

  it("renders empty state when data is null", async () => {
    mockGetDashboard.mockResolvedValue({ data: null });
    renderWithProviders(<Dashboard />);

    expect(await screen.findByText("Ingen data tillgänglig.")).toBeInTheDocument();
  });

  it("shows forecast section when available", async () => {
    mockGetDashboard.mockResolvedValue({
      data: {
        ...baseDashboard,
        forecast: {
          projectedIncome: 55000,
          projectedExpense: 42000,
          projectedYearEndResult: 156000,
          dataPoints: 3,
        },
      },
    });
    renderWithProviders(<Dashboard />);

    expect(await screen.findByText("Prognos")).toBeInTheDocument();
    expect(screen.getByText(/Baserat på linjär trend/)).toBeInTheDocument();
  });

  it("shows year comparison section when data exists", async () => {
    mockGetDashboard.mockResolvedValue({
      data: {
        ...baseDashboard,
        yearComparison: [
          {
            month: "01",
            currentIncome: 50000,
            currentExpense: 40000,
            previousIncome: 45000,
            previousExpense: 35000,
          },
        ],
        previousYearResult: 80000,
      },
    });
    renderWithProviders(<Dashboard />);

    expect(await screen.findByText("Årsjämförelse")).toBeInTheDocument();
  });
});
