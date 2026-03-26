import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetDispositionPreview, mockAddToast, mockUseOrganization } = vi.hoisted(() => ({
  mockGetDispositionPreview: vi.fn(),
  mockAddToast: vi.fn(),
  mockUseOrganization: vi.fn(),
}));

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: mockUseOrganization,
}));

vi.mock("../context/ToastContext", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock("../components/Dialog.module.css", () => ({ default: {} }));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: {
      ...actual.api,
      getDispositionPreview: mockGetDispositionPreview,
      executeDisposition: vi.fn(),
    },
  };
});

import { ResultDisposition } from "./ResultDisposition";

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

const samplePreview = {
  data: {
    netResult: 150000,
    lines: [
      { accountNumber: "2099", accountName: "Årets resultat", debit: 150000, credit: 0 },
      { accountNumber: "2091", accountName: "Balanserat resultat", debit: 0, credit: 150000 },
    ],
    isBalanced: true,
  },
};

describe("ResultDisposition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOrganization.mockReturnValue({
      organization: mockOrg,
      fiscalYears: [closedFy, openFy],
      fiscalYear: openFy,
    });
  });

  it("renders heading", () => {
    mockGetDispositionPreview.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<ResultDisposition />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Resultatdisposition" }),
    ).toBeInTheDocument();
  });

  it("shows empty state when no closed fiscal years", () => {
    mockUseOrganization.mockReturnValue({
      organization: mockOrg,
      fiscalYears: [openFy],
      fiscalYear: openFy,
    });
    renderWithProviders(<ResultDisposition />);
    expect(screen.getByText(/Inga stängda räkenskapsår finns/)).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockGetDispositionPreview.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<ResultDisposition />);
    expect(screen.getByText("Laddar förhandsvisning…")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockGetDispositionPreview.mockRejectedValue(new Error("Serverfel"));
    renderWithProviders(<ResultDisposition />);
    expect(await screen.findByText(/Kunde inte ladda förhandsvisning/)).toBeInTheDocument();
  });

  it("renders description text about konto 2099 and 2091", () => {
    mockGetDispositionPreview.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<ResultDisposition />);
    expect(screen.getByText(/konto 2099.*konto 2091/s)).toBeInTheDocument();
  });

  it("renders disposition lines table", async () => {
    mockGetDispositionPreview.mockResolvedValue(samplePreview);
    renderWithProviders(<ResultDisposition />);
    expect(await screen.findByText("2099")).toBeInTheDocument();
    expect(screen.getByText("2091")).toBeInTheDocument();
    expect(screen.getByText("Balanserat resultat")).toBeInTheDocument();
  });

  it("renders balance check passed", async () => {
    mockGetDispositionPreview.mockResolvedValue(samplePreview);
    renderWithProviders(<ResultDisposition />);
    expect(await screen.findByText(/Verifikatet balanserar/)).toBeInTheDocument();
  });

  it("renders execute button", async () => {
    mockGetDispositionPreview.mockResolvedValue(samplePreview);
    renderWithProviders(<ResultDisposition />);
    expect(await screen.findByText("Genomför resultatdisposition")).toBeInTheDocument();
  });

  it("shows no target FY error when missing", () => {
    mockUseOrganization.mockReturnValue({
      organization: mockOrg,
      fiscalYears: [closedFy],
      fiscalYear: closedFy,
    });
    renderWithProviders(<ResultDisposition />);
    expect(screen.getByText(/Inget öppet räkenskapsår hittades/)).toBeInTheDocument();
  });
});
