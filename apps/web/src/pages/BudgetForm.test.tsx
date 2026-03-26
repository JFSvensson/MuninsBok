import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetAccounts, mockGetBudget, mockAddToast } = vi.hoisted(() => ({
  mockGetAccounts: vi.fn(),
  mockGetBudget: vi.fn(),
  mockAddToast: vi.fn(),
}));

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1", name: "Test AB" },
    fiscalYear: { id: "fy-1", startDate: "2024-01-01", endDate: "2024-12-31" },
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
      getBudget: mockGetBudget,
      createBudget: vi.fn(),
      updateBudget: vi.fn(),
    },
  };
});

// Create mode (no budgetId)
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({}),
    useNavigate: () => vi.fn(),
  };
});

import { BudgetForm } from "./BudgetForm";

const sampleAccounts = {
  data: [
    { number: "5010", name: "Lokalhyra", type: "EXPENSE" },
    { number: "6110", name: "Kontorsmaterial", type: "EXPENSE" },
  ],
};

describe("BudgetForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccounts.mockResolvedValue(sampleAccounts);
    mockGetBudget.mockResolvedValue({ data: null });
  });

  it("renders create mode heading", async () => {
    renderWithProviders(<BudgetForm />);
    expect(await screen.findByRole("heading", { level: 2, name: "Ny budget" })).toBeInTheDocument();
  });

  it("renders budget name input", async () => {
    renderWithProviders(<BudgetForm />);
    expect(await screen.findByLabelText("Budgetnamn")).toBeInTheDocument();
  });

  it("renders table headers for entries", async () => {
    renderWithProviders(<BudgetForm />);
    await screen.findByText("Ny budget");
    for (const h of ["Konto", "Månad", "Belopp (kr)"]) {
      expect(screen.getByText(h)).toBeInTheDocument();
    }
  });

  it("renders month options in selects", async () => {
    renderWithProviders(<BudgetForm />);
    await screen.findByText("Ny budget");
    expect(screen.getAllByText("Jan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dec").length).toBeGreaterThan(0);
  });

  it("renders add-row and remove buttons", async () => {
    renderWithProviders(<BudgetForm />);
    await screen.findByText("Ny budget");
    expect(screen.getByText("+ Lägg till rad")).toBeInTheDocument();
    // Two rows by default, each with a remove button (×)
    expect(screen.getAllByText("×")).toHaveLength(2);
  });

  it("renders cancel and submit buttons", async () => {
    renderWithProviders(<BudgetForm />);
    await screen.findByText("Ny budget");
    expect(screen.getByText("Avbryt")).toBeInTheDocument();
    expect(screen.getByText("Skapa budget")).toBeInTheDocument();
  });

  it("renders account options when accounts load", async () => {
    renderWithProviders(<BudgetForm />);
    // Two entry rows, each with account selects
    const opts = await screen.findAllByText(/5010 Lokalhyra/);
    expect(opts.length).toBe(2);
    expect(screen.getAllByText(/6110 Kontorsmaterial/)).toHaveLength(2);
  });
});
