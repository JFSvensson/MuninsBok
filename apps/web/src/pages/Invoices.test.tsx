import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetInvoices, mockGetCustomers } = vi.hoisted(() => ({
  mockGetInvoices: vi.fn(),
  mockGetCustomers: vi.fn(),
}));

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1", name: "Test AB" },
  }),
}));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: {
      ...actual.api,
      getInvoices: mockGetInvoices,
      getCustomers: mockGetCustomers,
    },
  };
});

import { Invoices } from "./Invoices";

const baseInvoices = {
  data: [
    {
      id: "inv-1",
      invoiceNumber: "2024-001",
      customerId: "cust-1",
      issueDate: "2024-01-15",
      dueDate: "2024-02-15",
      totalAmount: 125000, // öre
      status: "SENT",
    },
    {
      id: "inv-2",
      invoiceNumber: "2024-002",
      customerId: "cust-2",
      issueDate: "2024-02-01",
      dueDate: "2024-03-01",
      totalAmount: 50000,
      status: "PAID",
    },
  ],
};

const baseCustomers = {
  data: [
    { id: "cust-1", name: "Företag AB" },
    { id: "cust-2", name: "Kunden HB" },
  ],
};

describe("Invoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCustomers.mockResolvedValue(baseCustomers);
  });

  it("shows loading state", () => {
    mockGetInvoices.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<Invoices />);
    expect(screen.getByText("Laddar…")).toBeInTheDocument();
  });

  it("renders heading", async () => {
    mockGetInvoices.mockResolvedValue(baseInvoices);
    renderWithProviders(<Invoices />);
    expect(await screen.findByRole("heading", { level: 2, name: "Fakturor" })).toBeInTheDocument();
  });

  it("renders new invoice button", async () => {
    mockGetInvoices.mockResolvedValue(baseInvoices);
    renderWithProviders(<Invoices />);
    expect(await screen.findByText("+ Ny faktura")).toBeInTheDocument();
  });

  it("shows empty state when no invoices", async () => {
    mockGetInvoices.mockResolvedValue({ data: [] });
    renderWithProviders(<Invoices />);
    expect(await screen.findByText("Inga fakturor ännu.")).toBeInTheDocument();
  });

  it("renders invoice rows with data", async () => {
    mockGetInvoices.mockResolvedValue(baseInvoices);
    renderWithProviders(<Invoices />);
    expect(await screen.findByText("2024-001")).toBeInTheDocument();
    expect(screen.getByText("2024-002")).toBeInTheDocument();
    expect(screen.getByText("Företag AB")).toBeInTheDocument();
    expect(screen.getByText("Kunden HB")).toBeInTheDocument();
  });

  it("renders status labels in table", async () => {
    mockGetInvoices.mockResolvedValue(baseInvoices);
    renderWithProviders(<Invoices />);
    await screen.findByText("2024-001");
    // Status text appears both in filter dropdown options and in table rows
    expect(screen.getAllByText("Skickad").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Betald").length).toBeGreaterThanOrEqual(2);
  });

  it("renders table headers", async () => {
    mockGetInvoices.mockResolvedValue(baseInvoices);
    renderWithProviders(<Invoices />);
    await screen.findByText("2024-001");
    expect(screen.getByText("Fakturanr")).toBeInTheDocument();
    expect(screen.getByText("Kund")).toBeInTheDocument();
    expect(screen.getByText("Fakturadatum")).toBeInTheDocument();
    expect(screen.getByText("Förfallodatum")).toBeInTheDocument();
  });

  it("renders status filter dropdown", async () => {
    mockGetInvoices.mockResolvedValue(baseInvoices);
    renderWithProviders(<Invoices />);
    await screen.findByText("2024-001");
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(screen.getByText("Alla")).toBeInTheDocument();
  });

  it("renders Visa links for each invoice", async () => {
    mockGetInvoices.mockResolvedValue(baseInvoices);
    renderWithProviders(<Invoices />);
    await screen.findByText("2024-001");
    const links = screen.getAllByText("Visa");
    expect(links.length).toBe(2);
  });
});
