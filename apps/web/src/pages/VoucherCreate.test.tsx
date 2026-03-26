import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/test-utils";

const {
  mockNavigate,
  mockGetAccounts,
  mockGetVoucherTemplates,
  mockGetReceiptOcrStatus,
  mockCreateVoucher,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGetAccounts: vi.fn(),
  mockGetVoucherTemplates: vi.fn(),
  mockGetReceiptOcrStatus: vi.fn(),
  mockCreateVoucher: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1" },
    fiscalYear: { id: "fy-1" },
  }),
}));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: {
      ...actual.api,
      getAccounts: mockGetAccounts,
      getVoucherTemplates: mockGetVoucherTemplates,
      getReceiptOcrStatus: mockGetReceiptOcrStatus,
      createVoucher: mockCreateVoucher,
    },
  };
});

import { VoucherCreate } from "./VoucherCreate";

describe("VoucherCreate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccounts.mockResolvedValue({
      data: [
        { number: "1930", name: "Företagskonto", type: "ASSET", isActive: true },
        { number: "4010", name: "Inköp varor", type: "EXPENSE", isActive: true },
      ],
    });
    mockGetVoucherTemplates.mockResolvedValue({ data: [] });
    mockGetReceiptOcrStatus.mockResolvedValue({ data: { pdfEnabled: false } });
  });

  it("renders form heading and basic fields", async () => {
    renderWithProviders(<VoucherCreate />);

    expect(await screen.findByText("Nytt verifikat")).toBeInTheDocument();
    expect(screen.getByLabelText("Datum")).toBeInTheDocument();
    expect(screen.getByLabelText("Beskrivning")).toBeInTheDocument();
    expect(screen.getByLabelText("Signatur")).toBeInTheDocument();
  });

  it("renders voucher line table with two initial rows", async () => {
    renderWithProviders(<VoucherCreate />);

    // Wait for accounts to load
    await screen.findByText("Nytt verifikat");

    // Should have at least two "Välj konto" dropdowns (two initial lines)
    const selectElements = screen.getAllByDisplayValue("Välj konto");
    expect(selectElements.length).toBeGreaterThanOrEqual(2);
  });

  it("shows save and cancel buttons", async () => {
    renderWithProviders(<VoucherCreate />);

    expect(await screen.findByText("Spara verifikat")).toBeInTheDocument();
    expect(screen.getByText("Avbryt")).toBeInTheDocument();
  });

  it("navigates back on cancel", async () => {
    const user = userEvent.setup();
    renderWithProviders(<VoucherCreate />);

    await user.click(await screen.findByText("Avbryt"));
    expect(mockNavigate).toHaveBeenCalledWith("/vouchers");
  });

  it("shows add-row button", async () => {
    renderWithProviders(<VoucherCreate />);

    expect(await screen.findByText("+ Lägg till rad")).toBeInTheDocument();
  });

  it("renders OCR section", async () => {
    renderWithProviders(<VoucherCreate />);

    expect(await screen.findByText("Kvitto-tolkning (OCR)")).toBeInTheDocument();
    expect(screen.getByText("Tolka kvitto")).toBeInTheDocument();
  });

  it("shows template selector when templates exist", async () => {
    mockGetVoucherTemplates.mockResolvedValue({
      data: [{ id: "tpl-1", name: "Standardmall" }],
    });
    renderWithProviders(<VoucherCreate />);

    expect(await screen.findByText("Fyll i från mall…")).toBeInTheDocument();
  });

  it("does not show template selector when no templates", async () => {
    renderWithProviders(<VoucherCreate />);

    await screen.findByText("Nytt verifikat");
    expect(screen.queryByText("Fyll i från mall…")).not.toBeInTheDocument();
  });

  it("populates account dropdowns with fetched accounts", async () => {
    renderWithProviders(<VoucherCreate />);

    const options = await screen.findAllByText("1930 Företagskonto");
    expect(options.length).toBeGreaterThanOrEqual(2); // one per voucher line
    expect(screen.getAllByText("4010 Inköp varor").length).toBeGreaterThanOrEqual(2);
  });
});
