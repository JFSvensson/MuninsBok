import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetYearEndSummary, mockUseOrganization } = vi.hoisted(() => ({
  mockGetYearEndSummary: vi.fn(),
  mockUseOrganization: vi.fn(),
}));

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: mockUseOrganization,
}));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: { ...actual.api, getYearEndSummary: mockGetYearEndSummary },
  };
});

import { YearEndSummary } from "./YearEndSummary";

const closedFy = {
  id: "fy-1",
  startDate: "2024-01-01",
  endDate: "2024-12-31",
  isClosed: true,
};

const openFy = {
  id: "fy-2",
  startDate: "2025-01-01",
  endDate: "2025-12-31",
  isClosed: false,
};

const mockOrg = {
  id: "org-1",
  name: "Test AB",
  orgNumber: "556677-8899",
  fiscalYearStartMonth: 1,
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
};

const sampleSummary = {
  data: {
    fiscalYear: closedFy,
    incomeStatement: {
      revenues: {
        title: "Intäkter",
        rows: [{ accountNumber: "3010", accountName: "Försäljning varor", amount: 500000 }],
        total: 500000,
      },
      expenses: {
        title: "Kostnader",
        rows: [{ accountNumber: "5010", accountName: "Lokalhyra", amount: -120000 }],
        total: -120000,
      },
      financialIncome: { title: "Finansiella intäkter", rows: [], total: 0 },
      financialExpenses: { title: "Finansiella kostnader", rows: [], total: 0 },
      operatingResult: 380000,
      netResult: 380000,
    },
    balanceSheet: {
      assets: {
        title: "Tillgångar",
        rows: [{ accountNumber: "1930", accountName: "Företagskonto", amount: 450000 }],
        total: 450000,
      },
      equity: {
        title: "Eget kapital",
        rows: [{ accountNumber: "2081", accountName: "Aktiekapital", amount: 50000 }],
        total: 50000,
      },
      liabilities: {
        title: "Skulder",
        rows: [{ accountNumber: "2440", accountName: "Leverantörsskulder", amount: 20000 }],
        total: 20000,
      },
      totalAssets: 450000,
      totalLiabilitiesAndEquity: 450000,
      difference: 0,
    },
    isDisposed: false,
    disposition: {
      netResult: 380000,
      lines: [
        { accountNumber: "2099", accountName: "Årets resultat", debit: 380000, credit: 0 },
        { accountNumber: "2091", accountName: "Balanserat resultat", debit: 0, credit: 380000 },
      ],
    },
    generatedAt: "2025-01-15T10:00:00Z",
  },
};

describe("YearEndSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOrganization.mockReturnValue({
      organization: mockOrg,
      fiscalYears: [closedFy, openFy],
      fiscalYear: closedFy,
    });
  });

  it("shows loading state", () => {
    mockGetYearEndSummary.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<YearEndSummary />);
    expect(screen.getByText("Laddar sammanställning…")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockGetYearEndSummary.mockRejectedValue(new Error("Serverfel"));
    renderWithProviders(<YearEndSummary />);
    expect(await screen.findByText("Kunde inte ladda sammanställning")).toBeInTheDocument();
  });

  it("renders heading", async () => {
    mockGetYearEndSummary.mockResolvedValue(sampleSummary);
    renderWithProviders(<YearEndSummary />);
    expect(
      await screen.findByRole("heading", { level: 2, name: /Sammanställning – Årsbokslut/ }),
    ).toBeInTheDocument();
  });

  it("renders income statement section", async () => {
    mockGetYearEndSummary.mockResolvedValue(sampleSummary);
    renderWithProviders(<YearEndSummary />);
    expect(await screen.findByText("Resultaträkning")).toBeInTheDocument();
    expect(screen.getByText("3010")).toBeInTheDocument();
    expect(screen.getByText("Försäljning varor")).toBeInTheDocument();
  });

  it("renders operating and net result", async () => {
    mockGetYearEndSummary.mockResolvedValue(sampleSummary);
    renderWithProviders(<YearEndSummary />);
    await screen.findByText("Resultaträkning");
    expect(screen.getByText("Rörelseresultat")).toBeInTheDocument();
    // "Årets resultat" appears in income statement and disposition section
    expect(screen.getAllByText("Årets resultat").length).toBeGreaterThanOrEqual(1);
  });

  it("renders balance sheet section", async () => {
    mockGetYearEndSummary.mockResolvedValue(sampleSummary);
    renderWithProviders(<YearEndSummary />);
    expect(await screen.findByText("Balansräkning")).toBeInTheDocument();
    expect(screen.getByText("1930")).toBeInTheDocument();
    expect(screen.getByText("Företagskonto")).toBeInTheDocument();
    expect(screen.getAllByText("Summa tillgångar")).toHaveLength(2);
    expect(screen.getByText("Summa eget kapital och skulder")).toBeInTheDocument();
  });

  it("renders disposition section with undisposed result", async () => {
    mockGetYearEndSummary.mockResolvedValue(sampleSummary);
    renderWithProviders(<YearEndSummary />);
    expect(await screen.findByText("Resultatdisposition")).toBeInTheDocument();
    expect(screen.getByText(/ej disponerat/)).toBeInTheDocument();
    expect(screen.getByText("2099")).toBeInTheDocument();
    expect(screen.getByText("2091")).toBeInTheDocument();
  });

  it("renders disposed status when result is disposed", async () => {
    mockGetYearEndSummary.mockResolvedValue({
      data: { ...sampleSummary.data, isDisposed: true, disposition: null },
    });
    renderWithProviders(<YearEndSummary />);
    expect(await screen.findByText(/Resultatet har disponerats/)).toBeInTheDocument();
  });

  it("shows print button", async () => {
    mockGetYearEndSummary.mockResolvedValue(sampleSummary);
    renderWithProviders(<YearEndSummary />);
    expect(await screen.findByText("Skriv ut")).toBeInTheDocument();
  });

  it("shows fiscal year badge", async () => {
    mockGetYearEndSummary.mockResolvedValue(sampleSummary);
    renderWithProviders(<YearEndSummary />);
    expect(await screen.findByText("Stängt")).toBeInTheDocument();
  });
});
