import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetGeneralLedger } = vi.hoisted(() => ({
  mockGetGeneralLedger: vi.fn(),
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
    api: { ...actual.api, getGeneralLedger: mockGetGeneralLedger },
  };
});

import { GeneralLedger } from "./GeneralLedger";

const baseReport = {
  data: {
    accounts: [
      {
        accountNumber: "1930",
        accountName: "Företagskonto",
        openingBalance: 0,
        closingBalance: 42000,
        totalDebit: 50000,
        totalCredit: 8000,
        transactions: [
          {
            voucherId: "v-1",
            date: "2026-01-15",
            voucherNumber: 1,
            description: "Insättning",
            debit: 50000,
            credit: 0,
            balance: 50000,
          },
          {
            voucherId: "v-2",
            date: "2026-02-01",
            voucherNumber: 2,
            description: "Hyra",
            debit: 0,
            credit: 8000,
            balance: 42000,
          },
        ],
      },
      {
        accountNumber: "5010",
        accountName: "Lokalhyra",
        openingBalance: 0,
        closingBalance: 8000,
        totalDebit: 8000,
        totalCredit: 0,
        transactions: [
          {
            voucherId: "v-2",
            date: "2026-02-01",
            voucherNumber: 2,
            description: "Hyra",
            debit: 8000,
            credit: 0,
            balance: 8000,
          },
        ],
      },
    ],
  },
};

describe("GeneralLedger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGetGeneralLedger.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<GeneralLedger />);
    expect(screen.getByText("Laddar huvudbok...")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockGetGeneralLedger.mockRejectedValue(new Error("Serverfel"));
    renderWithProviders(<GeneralLedger />);
    expect(await screen.findByText(/Serverfel/)).toBeInTheDocument();
  });

  it("shows empty state", async () => {
    mockGetGeneralLedger.mockResolvedValue({ data: { accounts: [] } });
    renderWithProviders(<GeneralLedger />);
    expect(await screen.findByText(/Inga bokförda transaktioner/)).toBeInTheDocument();
  });

  it("renders heading", async () => {
    mockGetGeneralLedger.mockResolvedValue(baseReport);
    renderWithProviders(<GeneralLedger />);
    expect(await screen.findByRole("heading", { level: 2, name: /Huvudbok/ })).toBeInTheDocument();
  });

  it("renders account sections with headings", async () => {
    mockGetGeneralLedger.mockResolvedValue(baseReport);
    renderWithProviders(<GeneralLedger />);
    expect(await screen.findByText(/1930 – Företagskonto/)).toBeInTheDocument();
    expect(screen.getByText(/5010 – Lokalhyra/)).toBeInTheDocument();
  });

  it("renders transaction rows", async () => {
    mockGetGeneralLedger.mockResolvedValue(baseReport);
    renderWithProviders(<GeneralLedger />);
    await screen.findByText(/1930 – Företagskonto/);
    expect(screen.getByText("Insättning")).toBeInTheDocument();
    expect(screen.getAllByText("Hyra").length).toBe(2);
  });

  it("renders export buttons", async () => {
    mockGetGeneralLedger.mockResolvedValue(baseReport);
    renderWithProviders(<GeneralLedger />);
    await screen.findByText(/1930/);
    expect(screen.getByText("Exportera CSV")).toBeInTheDocument();
    expect(screen.getByText("Exportera PDF")).toBeInTheDocument();
  });
});
