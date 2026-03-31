import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/test-utils";

const { mockUseOrganization } = vi.hoisted(() => ({
  mockUseOrganization: vi.fn(),
}));

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: mockUseOrganization,
}));

vi.mock("../hooks/useDialogFocus", () => ({
  useDialogFocus: () => ({ current: null }),
}));

vi.mock("./Dialog.module.css", () => ({ default: {} }));

import { OrganizationSelect } from "./OrganizationSelect";

const org1 = {
  id: "org-1",
  name: "Test AB",
  orgNumber: "5591234567",
  fiscalYearStartMonth: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const org2 = {
  id: "org-2",
  name: "Acme AB",
  orgNumber: "5591234568",
  fiscalYearStartMonth: 1,
  createdAt: "2026-02-01T00:00:00Z",
  updatedAt: "2026-02-01T00:00:00Z",
};

const fy1 = {
  id: "fy-1",
  organizationId: "org-1",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  isClosed: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const fy2 = {
  id: "fy-2",
  organizationId: "org-1",
  startDate: "2025-01-01",
  endDate: "2025-12-31",
  isClosed: true,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-12-31T00:00:00Z",
};

describe("OrganizationSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockUseOrganization.mockReturnValue({
      organization: null,
      fiscalYear: null,
      setOrganization: vi.fn(),
      setFiscalYear: vi.fn(),
      organizations: [],
      fiscalYears: [],
      isLoading: true,
    });
    renderWithProviders(<OrganizationSelect />);
    expect(screen.getByText("Laddar...")).toBeInTheDocument();
  });

  it("renders organization select with options", () => {
    mockUseOrganization.mockReturnValue({
      organization: null,
      fiscalYear: null,
      setOrganization: vi.fn(),
      setFiscalYear: vi.fn(),
      organizations: [org1, org2],
      fiscalYears: [],
      isLoading: false,
    });
    renderWithProviders(<OrganizationSelect />);
    expect(screen.getByText("Välj organisation")).toBeInTheDocument();
    expect(screen.getByText("Test AB")).toBeInTheDocument();
    expect(screen.getByText("Acme AB")).toBeInTheDocument();
  });

  it("renders new organization button", () => {
    mockUseOrganization.mockReturnValue({
      organization: null,
      fiscalYear: null,
      setOrganization: vi.fn(),
      setFiscalYear: vi.fn(),
      organizations: [],
      fiscalYears: [],
      isLoading: false,
    });
    renderWithProviders(<OrganizationSelect />);
    expect(screen.getByTitle("Ny organisation")).toBeInTheDocument();
  });

  it("shows edit and delete buttons when org is selected", () => {
    mockUseOrganization.mockReturnValue({
      organization: org1,
      fiscalYear: null,
      setOrganization: vi.fn(),
      setFiscalYear: vi.fn(),
      organizations: [org1],
      fiscalYears: [],
      isLoading: false,
    });
    renderWithProviders(<OrganizationSelect />);
    expect(screen.getByTitle("Redigera organisation")).toBeInTheDocument();
    expect(screen.getByTitle("Radera organisation")).toBeInTheDocument();
  });

  it("shows fiscal year select when org is selected", () => {
    mockUseOrganization.mockReturnValue({
      organization: org1,
      fiscalYear: fy1,
      setOrganization: vi.fn(),
      setFiscalYear: vi.fn(),
      organizations: [org1],
      fiscalYears: [fy1, fy2],
      isLoading: false,
    });
    renderWithProviders(<OrganizationSelect />);
    expect(screen.getByText("Välj räkenskapsår")).toBeInTheDocument();
    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.getByText("2025 (stängt)")).toBeInTheDocument();
  });

  it("shows new fiscal year button when org is selected", () => {
    mockUseOrganization.mockReturnValue({
      organization: org1,
      fiscalYear: null,
      setOrganization: vi.fn(),
      setFiscalYear: vi.fn(),
      organizations: [org1],
      fiscalYears: [],
      isLoading: false,
    });
    renderWithProviders(<OrganizationSelect />);
    expect(screen.getByTitle("Nytt räkenskapsår")).toBeInTheDocument();
  });

  it("calls setOrganization when org is changed", async () => {
    const mockSetOrg = vi.fn();
    mockUseOrganization.mockReturnValue({
      organization: null,
      fiscalYear: null,
      setOrganization: mockSetOrg,
      setFiscalYear: vi.fn(),
      organizations: [org1, org2],
      fiscalYears: [],
      isLoading: false,
    });

    const user = userEvent.setup();
    renderWithProviders(<OrganizationSelect />);

    const select = screen.getByDisplayValue("Välj organisation");
    await user.selectOptions(select, "org-1");
    expect(mockSetOrg).toHaveBeenCalledWith(org1);
  });

  it("calls setFiscalYear when fiscal year is changed", async () => {
    const mockSetFy = vi.fn();
    mockUseOrganization.mockReturnValue({
      organization: org1,
      fiscalYear: null,
      setOrganization: vi.fn(),
      setFiscalYear: mockSetFy,
      organizations: [org1],
      fiscalYears: [fy1, fy2],
      isLoading: false,
    });

    const user = userEvent.setup();
    renderWithProviders(<OrganizationSelect />);

    const fySelect = screen.getByDisplayValue("Välj räkenskapsår");
    await user.selectOptions(fySelect, "fy-1");
    expect(mockSetFy).toHaveBeenCalledWith(fy1);
  });

  it("hides fiscal year controls when no org is selected", () => {
    mockUseOrganization.mockReturnValue({
      organization: null,
      fiscalYear: null,
      setOrganization: vi.fn(),
      setFiscalYear: vi.fn(),
      organizations: [org1],
      fiscalYears: [],
      isLoading: false,
    });
    renderWithProviders(<OrganizationSelect />);
    expect(screen.queryByText("Välj räkenskapsår")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Redigera organisation")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Radera organisation")).not.toBeInTheDocument();
  });
});
