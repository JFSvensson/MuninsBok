import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetCustomers, mockGetInvoice, mockAddToast } = vi.hoisted(() => ({
  mockGetCustomers: vi.fn(),
  mockGetInvoice: vi.fn(),
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
      getCustomers: mockGetCustomers,
      getInvoice: mockGetInvoice,
      createInvoice: vi.fn(),
      updateInvoice: vi.fn(),
    },
  };
});

// Create mode (no invoiceId)
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({}),
    useNavigate: () => vi.fn(),
  };
});

import { InvoiceForm } from "./InvoiceForm";

const sampleCustomers = {
  data: [
    { id: "cust-1", customerNumber: "K001", name: "Kund AB" },
    { id: "cust-2", customerNumber: "K002", name: "Kund XY" },
  ],
};

describe("InvoiceForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCustomers.mockResolvedValue(sampleCustomers);
    mockGetInvoice.mockResolvedValue({ data: null });
  });

  it("renders create mode heading", async () => {
    renderWithProviders(<InvoiceForm />);
    expect(
      await screen.findByRole("heading", { level: 2, name: "Ny faktura" }),
    ).toBeInTheDocument();
  });

  it("renders customer select", async () => {
    renderWithProviders(<InvoiceForm />);
    expect(await screen.findByText("– Välj kund –")).toBeInTheDocument();
  });

  it("renders customer options", async () => {
    renderWithProviders(<InvoiceForm />);
    expect(await screen.findByText(/K001 – Kund AB/)).toBeInTheDocument();
    expect(screen.getByText(/K002 – Kund XY/)).toBeInTheDocument();
  });

  it("renders date fields", async () => {
    renderWithProviders(<InvoiceForm />);
    await screen.findByText("Ny faktura");
    expect(screen.getByText(/Fakturadatum/)).toBeInTheDocument();
    expect(screen.getByText(/Förfallodatum/)).toBeInTheDocument();
  });

  it("renders invoice lines table headers", async () => {
    renderWithProviders(<InvoiceForm />);
    expect(await screen.findByText("Fakturarader")).toBeInTheDocument();
    expect(screen.getByText("Beskrivning")).toBeInTheDocument();
    expect(screen.getByText("Antal")).toBeInTheDocument();
  });

  it("renders add line button", async () => {
    renderWithProviders(<InvoiceForm />);
    expect(await screen.findByText("+ Lägg till rad")).toBeInTheDocument();
  });

  it("renders totals preview", async () => {
    renderWithProviders(<InvoiceForm />);
    await screen.findByText("Ny faktura");
    expect(screen.getByText(/Netto:/)).toBeInTheDocument();
    expect(screen.getByText(/^Moms:/)).toBeInTheDocument();
    expect(screen.getByText(/^Totalt:/)).toBeInTheDocument();
  });

  it("renders save and cancel buttons", async () => {
    renderWithProviders(<InvoiceForm />);
    await screen.findByText("Ny faktura");
    expect(screen.getByText("Avbryt")).toBeInTheDocument();
    expect(screen.getByText("Spara")).toBeInTheDocument();
  });

  it("renders vat rate options", async () => {
    renderWithProviders(<InvoiceForm />);
    await screen.findByText("Ny faktura");
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("12%")).toBeInTheDocument();
    expect(screen.getByText("6%")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
