import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetBalanceSheet } = vi.hoisted(() => ({
  mockGetBalanceSheet: vi.fn(),
}));

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1", name: "Test AB" },
    fiscalYear: { id: "fy-1", startDate: "2026-01-01", endDate: "2026-12-31" },
  }),
}));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: { ...actual.api, getBalanceSheet: mockGetBalanceSheet },
  };
});

import { BalanceSheet } from "./BalanceSheet";

const baseReport = {
  data: {
    assets: {
      title: "Tillgångar",
      rows: [{ accountNumber: "1930", accountName: "Företagskonto", amount: 150000 }],
      total: 150000,
    },
    equity: {
      title: "Eget kapital",
      rows: [{ accountNumber: "2081", accountName: "Aktiekapital", amount: 50000 }],
      total: 50000,
    },
    liabilities: {
      title: "Skulder",
      rows: [{ accountNumber: "2440", accountName: "Leverantörsskulder", amount: 80000 }],
      total: 80000,
    },
    yearResult: 20000,
    totalAssets: 150000,
    totalLiabilitiesAndEquity: 150000,
    difference: 0,
  },
};

describe("BalanceSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGetBalanceSheet.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<BalanceSheet />);
    expect(screen.getByText("Laddar balansräkning...")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockGetBalanceSheet.mockRejectedValue(new Error("Fel vid anslutning"));
    renderWithProviders(<BalanceSheet />);
    expect(await screen.findByText(/Fel vid anslutning/)).toBeInTheDocument();
  });

  it("shows empty state", async () => {
    mockGetBalanceSheet.mockResolvedValue({ data: null });
    renderWithProviders(<BalanceSheet />);
    expect(await screen.findByText(/Inga bokförda transaktioner/)).toBeInTheDocument();
  });

  it("renders heading", async () => {
    mockGetBalanceSheet.mockResolvedValue(baseReport);
    renderWithProviders(<BalanceSheet />);
    expect(
      await screen.findByRole("heading", { level: 2, name: /Balansräkning/ }),
    ).toBeInTheDocument();
  });

  it("renders asset section", async () => {
    mockGetBalanceSheet.mockResolvedValue(baseReport);
    renderWithProviders(<BalanceSheet />);
    expect(
      await screen.findByRole("heading", { level: 3, name: /Tillgångar/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("1930")).toBeInTheDocument();
    expect(screen.getByText("Företagskonto")).toBeInTheDocument();
  });

  it("renders equity section", async () => {
    mockGetBalanceSheet.mockResolvedValue(baseReport);
    renderWithProviders(<BalanceSheet />);
    expect(await screen.findByText("Eget kapital och skulder")).toBeInTheDocument();
    expect(screen.getByText("2081")).toBeInTheDocument();
    expect(screen.getByText("Aktiekapital")).toBeInTheDocument();
  });

  it("renders export buttons", async () => {
    mockGetBalanceSheet.mockResolvedValue(baseReport);
    renderWithProviders(<BalanceSheet />);
    await screen.findByText("1930");
    expect(screen.getByText("Exportera CSV")).toBeInTheDocument();
    expect(screen.getByText("Exportera PDF")).toBeInTheDocument();
  });
});
