import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetVatReport } = vi.hoisted(() => ({
  mockGetVatReport: vi.fn(),
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
      getVatReport: mockGetVatReport,
    },
  };
});

import { VatReport } from "./VatReport";

const sampleReport = {
  data: {
    outputVat: [
      { accountNumber: "2610", accountName: "Utgående moms 25%", amount: 250000 },
      { accountNumber: "2620", accountName: "Utgående moms 12%", amount: 60000 },
    ],
    inputVat: [{ accountNumber: "2640", accountName: "Ingående moms", amount: -180000 }],
    totalOutputVat: 310000,
    totalInputVat: -180000,
    vatPayable: 130000,
  },
};

describe("VatReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGetVatReport.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<VatReport />);
    expect(screen.getByText("Laddar momsrapport...")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockGetVatReport.mockRejectedValue(new Error("Serverfel"));
    renderWithProviders(<VatReport />);
    expect(await screen.findByText(/Serverfel/)).toBeInTheDocument();
  });

  it("shows empty state when no data", async () => {
    mockGetVatReport.mockResolvedValue({
      data: { outputVat: [], inputVat: [], totalOutputVat: 0, totalInputVat: 0, vatPayable: 0 },
    });
    renderWithProviders(<VatReport />);
    expect(await screen.findByText(/Inga momstransaktioner/)).toBeInTheDocument();
  });

  it("renders heading", async () => {
    mockGetVatReport.mockResolvedValue(sampleReport);
    renderWithProviders(<VatReport />);
    expect(
      await screen.findByRole("heading", { level: 2, name: "Momsrapport" }),
    ).toBeInTheDocument();
  });

  it("renders output vat section", async () => {
    mockGetVatReport.mockResolvedValue(sampleReport);
    renderWithProviders(<VatReport />);
    expect(await screen.findByText("Utgående moms")).toBeInTheDocument();
    expect(screen.getByText("Utgående moms 25%")).toBeInTheDocument();
    expect(screen.getByText("2610")).toBeInTheDocument();
  });

  it("renders input vat section", async () => {
    mockGetVatReport.mockResolvedValue(sampleReport);
    renderWithProviders(<VatReport />);
    expect(await screen.findByText(/Ingående moms \(avdragsgill\)/)).toBeInTheDocument();
    expect(screen.getByText("2640")).toBeInTheDocument();
  });

  it("renders vat payable summary", async () => {
    mockGetVatReport.mockResolvedValue(sampleReport);
    renderWithProviders(<VatReport />);
    await screen.findByText("Utgående moms 25%");
    expect(screen.getByText("Moms att betala")).toBeInTheDocument();
  });

  it("renders table headers", async () => {
    mockGetVatReport.mockResolvedValue(sampleReport);
    renderWithProviders(<VatReport />);
    await screen.findByText("Utgående moms 25%");
    expect(screen.getByText("Konto")).toBeInTheDocument();
    expect(screen.getByText("Namn")).toBeInTheDocument();
    expect(screen.getByText("Belopp (kr)")).toBeInTheDocument();
  });
});
