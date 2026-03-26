import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetIncomeStatement } = vi.hoisted(() => ({
  mockGetIncomeStatement: vi.fn(),
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
    api: { ...actual.api, getIncomeStatement: mockGetIncomeStatement },
  };
});

import { IncomeStatement } from "./IncomeStatement";

const section = (
  title: string,
  rows: { accountNumber: string; accountName: string; amount: number }[],
) => ({
  title,
  rows,
  total: rows.reduce((s, r) => s + r.amount, 0),
});

const baseReport = {
  data: {
    revenues: section("Intäkter", [
      { accountNumber: "3000", accountName: "Försäljning", amount: 200000 },
    ]),
    expenses: section("Kostnader", [
      { accountNumber: "5010", accountName: "Lokalhyra", amount: -60000 },
    ]),
    financialIncome: section("Finansiella intäkter", []),
    financialExpenses: section("Finansiella kostnader", []),
    operatingResult: 140000,
    netResult: 140000,
  },
};

describe("IncomeStatement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGetIncomeStatement.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<IncomeStatement />);
    expect(screen.getByText("Laddar resultaträkning...")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockGetIncomeStatement.mockRejectedValue(new Error("Timeout"));
    renderWithProviders(<IncomeStatement />);
    expect(await screen.findByText(/Timeout/)).toBeInTheDocument();
  });

  it("shows empty state", async () => {
    mockGetIncomeStatement.mockResolvedValue({ data: null });
    renderWithProviders(<IncomeStatement />);
    expect(await screen.findByText(/Inga bokförda transaktioner/)).toBeInTheDocument();
  });

  it("renders heading", async () => {
    mockGetIncomeStatement.mockResolvedValue(baseReport);
    renderWithProviders(<IncomeStatement />);
    expect(
      await screen.findByRole("heading", { level: 2, name: /Resultaträkning/ }),
    ).toBeInTheDocument();
  });

  it("renders revenue and expense rows", async () => {
    mockGetIncomeStatement.mockResolvedValue(baseReport);
    renderWithProviders(<IncomeStatement />);
    expect(await screen.findByText("3000")).toBeInTheDocument();
    expect(screen.getByText("Försäljning")).toBeInTheDocument();
    expect(screen.getByText("5010")).toBeInTheDocument();
    expect(screen.getByText("Lokalhyra")).toBeInTheDocument();
  });

  it("renders operating result and net result rows", async () => {
    mockGetIncomeStatement.mockResolvedValue(baseReport);
    renderWithProviders(<IncomeStatement />);
    await screen.findByText("3000");
    expect(screen.getByText("Rörelseresultat")).toBeInTheDocument();
    expect(screen.getByText("Årets resultat")).toBeInTheDocument();
  });

  it("renders export buttons", async () => {
    mockGetIncomeStatement.mockResolvedValue(baseReport);
    renderWithProviders(<IncomeStatement />);
    await screen.findByText("3000");
    expect(screen.getByText("Exportera CSV")).toBeInTheDocument();
    expect(screen.getByText("Exportera PDF")).toBeInTheDocument();
  });
});
