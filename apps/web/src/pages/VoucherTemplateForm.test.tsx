import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetAccounts, mockGetVoucherTemplate, mockAddToast } = vi.hoisted(() => ({
  mockGetAccounts: vi.fn(),
  mockGetVoucherTemplate: vi.fn(),
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
      getAccounts: mockGetAccounts,
      getVoucherTemplate: mockGetVoucherTemplate,
      createVoucherTemplate: vi.fn(),
      updateVoucherTemplate: vi.fn(),
      updateRecurringSchedule: vi.fn(),
    },
  };
});

// Create mode (no templateId)
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({}),
    useNavigate: () => vi.fn(),
  };
});

import { VoucherTemplateForm } from "./VoucherTemplateForm";

const sampleAccounts = {
  data: [
    { number: "1930", name: "Företagskonto", type: "ASSET" },
    { number: "5010", name: "Lokalhyra", type: "EXPENSE" },
  ],
};

describe("VoucherTemplateForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccounts.mockResolvedValue(sampleAccounts);
    mockGetVoucherTemplate.mockResolvedValue({ data: null });
  });

  it("renders create mode heading", async () => {
    renderWithProviders(<VoucherTemplateForm />);
    expect(
      await screen.findByRole("heading", { level: 2, name: "Ny verifikatmall" }),
    ).toBeInTheDocument();
  });

  it("renders name and description fields", async () => {
    renderWithProviders(<VoucherTemplateForm />);
    expect(await screen.findByLabelText("Mallnamn")).toBeInTheDocument();
    expect(screen.getByLabelText(/Beskrivning/)).toBeInTheDocument();
  });

  it("renders table headers for lines", async () => {
    renderWithProviders(<VoucherTemplateForm />);
    await screen.findByText("Ny verifikatmall");
    expect(screen.getByText("Debet (kr)")).toBeInTheDocument();
    expect(screen.getByText("Kredit (kr)")).toBeInTheDocument();
  });

  it("renders add-row button", async () => {
    renderWithProviders(<VoucherTemplateForm />);
    expect(await screen.findByText("+ Lägg till rad")).toBeInTheDocument();
  });

  it("renders cancel and submit buttons", async () => {
    renderWithProviders(<VoucherTemplateForm />);
    await screen.findByText("Ny verifikatmall");
    expect(screen.getByText("Avbryt")).toBeInTheDocument();
    expect(screen.getByText("Skapa mall")).toBeInTheDocument();
  });

  it("renders account options when accounts load", async () => {
    renderWithProviders(<VoucherTemplateForm />);
    // Two line rows each have account selects
    const opts = await screen.findAllByText(/1930 Företagskonto/);
    expect(opts.length).toBe(2);
  });

  it("renders remove buttons for line rows", async () => {
    renderWithProviders(<VoucherTemplateForm />);
    await screen.findByText("Ny verifikatmall");
    // Two default rows each with ×
    expect(screen.getAllByText("×")).toHaveLength(2);
  });
});
