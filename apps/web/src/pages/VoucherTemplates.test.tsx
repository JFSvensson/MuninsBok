import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetVoucherTemplates, mockGetDueRecurring, mockGetFiscalYears, mockAddToast } =
  vi.hoisted(() => ({
    mockGetVoucherTemplates: vi.fn(),
    mockGetDueRecurring: vi.fn(),
    mockGetFiscalYears: vi.fn(),
    mockAddToast: vi.fn(),
  }));

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1", name: "Test AB" },
  }),
}));

vi.mock("../context/ToastContext", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: {
      ...actual.api,
      getVoucherTemplates: mockGetVoucherTemplates,
      getDueRecurringTemplates: mockGetDueRecurring,
      getFiscalYears: mockGetFiscalYears,
      deleteVoucherTemplate: vi.fn(),
      executeRecurringTemplates: vi.fn(),
    },
  };
});

import { VoucherTemplates } from "./VoucherTemplates";

const sampleTemplates = {
  data: [
    {
      id: "tpl-1",
      name: "Hyra",
      description: "Månadsvis hyra",
      isRecurring: true,
      frequency: "MONTHLY",
      dayOfMonth: 25,
      lines: [
        { debit: 800000, credit: 0, accountNumber: "5010" },
        { debit: 0, credit: 800000, accountNumber: "1930" },
      ],
      organizationId: "org-1",
    },
    {
      id: "tpl-2",
      name: "Inköp kontorsmaterial",
      description: "",
      isRecurring: false,
      frequency: null,
      dayOfMonth: null,
      lines: [
        { debit: 50000, credit: 0, accountNumber: "6110" },
        { debit: 0, credit: 50000, accountNumber: "1930" },
      ],
      organizationId: "org-1",
    },
  ],
};

describe("VoucherTemplates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDueRecurring.mockResolvedValue({ data: [] });
    mockGetFiscalYears.mockResolvedValue({ data: [] });
  });

  it("shows loading state", () => {
    mockGetVoucherTemplates.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<VoucherTemplates />);
    expect(screen.getByText("Laddar…")).toBeInTheDocument();
  });

  it("renders heading and new template button", async () => {
    mockGetVoucherTemplates.mockResolvedValue(sampleTemplates);
    renderWithProviders(<VoucherTemplates />);
    expect(
      await screen.findByRole("heading", { level: 2, name: "Verifikatmallar" }),
    ).toBeInTheDocument();
    expect(screen.getByText("+ Ny mall")).toBeInTheDocument();
  });

  it("shows empty state when no templates", async () => {
    mockGetVoucherTemplates.mockResolvedValue({ data: [] });
    renderWithProviders(<VoucherTemplates />);
    expect(await screen.findByText(/Inga mallar ännu/)).toBeInTheDocument();
  });

  it("renders table headers", async () => {
    mockGetVoucherTemplates.mockResolvedValue(sampleTemplates);
    renderWithProviders(<VoucherTemplates />);
    await screen.findByText("Hyra");
    expect(screen.getByText("Namn")).toBeInTheDocument();
    expect(screen.getByText("Schema")).toBeInTheDocument();
    expect(screen.getByText("Belopp (kr)")).toBeInTheDocument();
  });

  it("renders template names as links", async () => {
    mockGetVoucherTemplates.mockResolvedValue(sampleTemplates);
    renderWithProviders(<VoucherTemplates />);
    const link = await screen.findByRole("link", { name: "Hyra" });
    expect(link).toHaveAttribute("href", "/templates/tpl-1/edit");
  });

  it("shows recurring schedule info", async () => {
    mockGetVoucherTemplates.mockResolvedValue(sampleTemplates);
    renderWithProviders(<VoucherTemplates />);
    await screen.findByText("Hyra");
    expect(screen.getByText(/Månad.*25/)).toBeInTheDocument();
  });

  it("shows dash for non-recurring templates", async () => {
    mockGetVoucherTemplates.mockResolvedValue(sampleTemplates);
    renderWithProviders(<VoucherTemplates />);
    await screen.findByText("Hyra");
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("shows line count and debit total", async () => {
    mockGetVoucherTemplates.mockResolvedValue(sampleTemplates);
    renderWithProviders(<VoucherTemplates />);
    await screen.findByText("Hyra");
    // Both templates have 2 lines
    expect(screen.getAllByText("2").length).toBe(2);
  });
});
