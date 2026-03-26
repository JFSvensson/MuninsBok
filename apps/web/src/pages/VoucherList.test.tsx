import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/test-utils";

const { mockNavigate, mockGetVouchers, mockGetVoucherGaps } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGetVouchers: vi.fn(),
  mockGetVoucherGaps: vi.fn(),
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
      getVouchers: mockGetVouchers,
      getVoucherGaps: mockGetVoucherGaps,
    },
  };
});

import { VoucherList } from "./VoucherList";

const baseVouchers = {
  data: [
    {
      id: "v-1",
      number: 1,
      date: "2026-01-15",
      description: "Hyra kontor",
      status: "APPROVED" as const,
      correctedByVoucherId: null,
      correctsVoucherId: null,
      lines: [
        { debit: 800000, credit: 0 },
        { debit: 0, credit: 800000 },
      ],
    },
    {
      id: "v-2",
      number: 2,
      date: "2026-02-01",
      description: "Löneutbetalning",
      status: "DRAFT" as const,
      correctedByVoucherId: null,
      correctsVoucherId: null,
      lines: [
        { debit: 2500000, credit: 0 },
        { debit: 0, credit: 2500000 },
      ],
    },
  ],
  pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
};

describe("VoucherList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetVoucherGaps.mockResolvedValue({ data: { count: 0, gaps: [] } });
  });

  it("shows loading state", () => {
    mockGetVouchers.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<VoucherList />);
    expect(screen.getByText("Laddar verifikat...")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockGetVouchers.mockRejectedValue(new Error("Nätverksfel"));
    renderWithProviders(<VoucherList />);
    expect(await screen.findByText(/Nätverksfel/)).toBeInTheDocument();
  });

  it("shows empty state when no vouchers", async () => {
    mockGetVouchers.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });
    renderWithProviders(<VoucherList />);
    expect(await screen.findByText(/Inga verifikat ännu/)).toBeInTheDocument();
  });

  it("renders voucher table with data", async () => {
    mockGetVouchers.mockResolvedValue(baseVouchers);
    renderWithProviders(<VoucherList />);
    expect(await screen.findByText("Hyra kontor")).toBeInTheDocument();
    expect(screen.getByText("Löneutbetalning")).toBeInTheDocument();
  });

  it("renders the heading and new-voucher button", async () => {
    mockGetVouchers.mockResolvedValue(baseVouchers);
    renderWithProviders(<VoucherList />);
    expect(await screen.findByRole("heading", { level: 2, name: /Verifikat/ })).toBeInTheDocument();
    expect(screen.getByText("+ Nytt verifikat")).toBeInTheDocument();
  });

  it("navigates to new voucher on button click", async () => {
    mockGetVouchers.mockResolvedValue(baseVouchers);
    const user = userEvent.setup();
    renderWithProviders(<VoucherList />);
    await screen.findByText("Hyra kontor");
    await user.click(screen.getByText("+ Nytt verifikat"));
    expect(mockNavigate).toHaveBeenCalledWith("/vouchers/new");
  });

  it("navigates to voucher detail on row click", async () => {
    mockGetVouchers.mockResolvedValue(baseVouchers);
    const user = userEvent.setup();
    renderWithProviders(<VoucherList />);
    await user.click(await screen.findByText("Hyra kontor"));
    expect(mockNavigate).toHaveBeenCalledWith("/vouchers/v-1");
  });

  it("shows search form", async () => {
    mockGetVouchers.mockResolvedValue(baseVouchers);
    renderWithProviders(<VoucherList />);
    await screen.findByText("Hyra kontor");
    expect(screen.getByPlaceholderText(/Sök verifikat/)).toBeInTheDocument();
    expect(screen.getByText("Sök")).toBeInTheDocument();
  });

  it("shows gap warnings when present", async () => {
    mockGetVouchers.mockResolvedValue(baseVouchers);
    mockGetVoucherGaps.mockResolvedValue({ data: { count: 2, gaps: [3, 5] } });
    renderWithProviders(<VoucherList />);
    expect(await screen.findByText(/Luckor i verifikatnumrering/)).toBeInTheDocument();
    expect(screen.getByText(/Nummer 3, 5 saknas/)).toBeInTheDocument();
  });

  it("shows corrected badge for corrected vouchers", async () => {
    const vouchers = {
      ...baseVouchers,
      data: [
        {
          ...baseVouchers.data[0],
          correctedByVoucherId: "v-99",
        },
      ],
    };
    mockGetVouchers.mockResolvedValue(vouchers);
    renderWithProviders(<VoucherList />);
    expect(await screen.findByText("Rättat")).toBeInTheDocument();
  });

  it("shows correction badge for correction vouchers", async () => {
    const vouchers = {
      ...baseVouchers,
      data: [
        {
          ...baseVouchers.data[0],
          correctsVoucherId: "v-00",
        },
      ],
    };
    mockGetVouchers.mockResolvedValue(vouchers);
    renderWithProviders(<VoucherList />);
    expect(await screen.findByText("Rättelse")).toBeInTheDocument();
  });
});
