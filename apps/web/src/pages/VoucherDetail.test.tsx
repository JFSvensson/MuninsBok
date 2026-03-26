import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/test-utils";

const { mockNavigate, mockGetVoucher, mockCorrectVoucher, mockSubmitForApproval, mockAddToast } =
  vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockGetVoucher: vi.fn(),
    mockCorrectVoucher: vi.fn(),
    mockSubmitForApproval: vi.fn(),
    mockAddToast: vi.fn(),
  }));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ voucherId: "v-1" }),
  };
});

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1" },
    fiscalYear: { id: "fy-1" },
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
      getVoucher: mockGetVoucher,
      correctVoucher: mockCorrectVoucher,
      submitVoucherForApproval: mockSubmitForApproval,
      getVoucherDocuments: vi.fn().mockResolvedValue({ data: [] }),
    },
  };
});

import { VoucherDetail } from "./VoucherDetail";

const baseVoucher = {
  id: "v-1",
  number: 5,
  date: "2026-03-15",
  description: "Kontorshyra",
  status: "DRAFT" as const,
  createdAt: "2026-03-15T10:00:00Z",
  createdBy: "anna",
  correctedByVoucherId: null,
  correctsVoucherId: null,
  lines: [
    { id: "l-1", accountNumber: "5010", description: "Lokalhyra", debit: 800000, credit: 0 },
    { id: "l-2", accountNumber: "1930", description: "Bankkonto", debit: 0, credit: 800000 },
  ],
};

describe("VoucherDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGetVoucher.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<VoucherDetail />);
    expect(screen.getByText("Laddar verifikat...")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockGetVoucher.mockRejectedValue(new Error("Serverfel"));
    renderWithProviders(<VoucherDetail />);
    expect(await screen.findByText(/Serverfel/)).toBeInTheDocument();
  });

  it("shows not found when voucher is null", async () => {
    mockGetVoucher.mockResolvedValue({ data: null });
    renderWithProviders(<VoucherDetail />);
    expect(await screen.findByText("Verifikatet hittades inte.")).toBeInTheDocument();
  });

  it("renders voucher header with number", async () => {
    mockGetVoucher.mockResolvedValue({ data: baseVoucher });
    renderWithProviders(<VoucherDetail />);
    expect(await screen.findByText(/Verifikat #5/)).toBeInTheDocument();
  });

  it("renders voucher date and description", async () => {
    mockGetVoucher.mockResolvedValue({ data: baseVoucher });
    renderWithProviders(<VoucherDetail />);
    await screen.findByText(/Verifikat #5/);
    expect(screen.getByText("Kontorshyra")).toBeInTheDocument();
  });

  it("renders voucher lines in table", async () => {
    mockGetVoucher.mockResolvedValue({ data: baseVoucher });
    renderWithProviders(<VoucherDetail />);
    await screen.findByText(/Verifikat #5/);
    expect(screen.getByText("5010")).toBeInTheDocument();
    expect(screen.getByText("1930")).toBeInTheDocument();
  });

  it("shows back button that navigates to voucher list", async () => {
    mockGetVoucher.mockResolvedValue({ data: baseVoucher });
    const user = userEvent.setup();
    renderWithProviders(<VoucherDetail />);
    await user.click(await screen.findByText("← Tillbaka"));
    expect(mockNavigate).toHaveBeenCalledWith("/vouchers");
  });

  it("shows submit button for DRAFT vouchers", async () => {
    mockGetVoucher.mockResolvedValue({ data: baseVoucher });
    renderWithProviders(<VoucherDetail />);
    await screen.findByText(/Verifikat #5/);
    expect(screen.getByRole("button", { name: /Skicka för attestering/ })).toBeInTheDocument();
  });

  it("shows correction button for non-corrected vouchers", async () => {
    mockGetVoucher.mockResolvedValue({ data: baseVoucher });
    renderWithProviders(<VoucherDetail />);
    await screen.findByText(/Verifikat #5/);
    expect(screen.getByText("Rätta")).toBeInTheDocument();
  });

  it("shows corrected badge when voucher is corrected", async () => {
    mockGetVoucher.mockResolvedValue({
      data: { ...baseVoucher, correctedByVoucherId: "v-99" },
    });
    renderWithProviders(<VoucherDetail />);
    expect(await screen.findByText("Rättat")).toBeInTheDocument();
  });

  it("shows correction badge when voucher is a correction", async () => {
    mockGetVoucher.mockResolvedValue({
      data: { ...baseVoucher, correctsVoucherId: "v-00" },
    });
    renderWithProviders(<VoucherDetail />);
    expect(await screen.findByText("Rättelseverifikat")).toBeInTheDocument();
  });

  it("shows correction help text for normal vouchers", async () => {
    mockGetVoucher.mockResolvedValue({ data: baseVoucher });
    renderWithProviders(<VoucherDetail />);
    await screen.findByText(/Verifikat #5/);
    expect(screen.getByText("Om rättelse av verifikat")).toBeInTheDocument();
  });

  it("shows signature when present", async () => {
    mockGetVoucher.mockResolvedValue({ data: baseVoucher });
    renderWithProviders(<VoucherDetail />);
    await screen.findByText(/Verifikat #5/);
    expect(screen.getByText("anna")).toBeInTheDocument();
  });
});
