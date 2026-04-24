import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/test-utils";

const {
  mockAddToast,
  mockGetBankTransactions,
  mockGetBankMatchCandidates,
  mockCreateVoucherFromBankTransaction,
  mockMatchBankTransaction,
  mockUnmatchBankTransaction,
  mockConfirmBankTransaction,
  mockBulkConfirmBankTransactions,
  mockBulkUnmatchBankTransactions,
} = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockGetBankTransactions: vi.fn(),
  mockGetBankMatchCandidates: vi.fn(),
  mockCreateVoucherFromBankTransaction: vi.fn(),
  mockMatchBankTransaction: vi.fn(),
  mockUnmatchBankTransaction: vi.fn(),
  mockConfirmBankTransaction: vi.fn(),
  mockBulkConfirmBankTransactions: vi.fn(),
  mockBulkUnmatchBankTransactions: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ connectionId: "conn-1" }),
  };
});

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1" },
  }),
}));

vi.mock("../context/ToastContext", () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}));

vi.mock("../utils/bank-feature-flag", () => ({
  isBankingEnabledForOrganization: () => true,
}));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: {
      ...actual.api,
      getBankTransactions: mockGetBankTransactions,
      getBankMatchCandidates: mockGetBankMatchCandidates,
      createVoucherFromBankTransaction: mockCreateVoucherFromBankTransaction,
      matchBankTransaction: mockMatchBankTransaction,
      unmatchBankTransaction: mockUnmatchBankTransaction,
      confirmBankTransaction: mockConfirmBankTransaction,
      bulkConfirmBankTransactions: mockBulkConfirmBankTransactions,
      bulkUnmatchBankTransactions: mockBulkUnmatchBankTransactions,
    },
  };
});

import { BankTransactions } from "./BankTransactions";

describe("BankTransactions create voucher modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetBankTransactions.mockResolvedValue({
      data: [
        {
          id: "tx-1",
          bookedAt: "2026-03-01T00:00:00.000Z",
          description: "Leverantörsbetalning",
          amountOre: -125000,
          currency: "SEK",
          matchStatus: "PENDING_MATCH",
          counterpartyName: "Test AB",
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });

    mockGetBankMatchCandidates.mockResolvedValue({ data: [] });
    mockMatchBankTransaction.mockResolvedValue({ data: {} });
    mockUnmatchBankTransaction.mockResolvedValue({ data: {} });
    mockConfirmBankTransaction.mockResolvedValue({ data: {} });
    mockCreateVoucherFromBankTransaction.mockResolvedValue({
      data: { voucher: { number: 101 } },
    });
    mockBulkConfirmBankTransactions.mockResolvedValue({ data: { updated: 1 } });
    mockBulkUnmatchBankTransactions.mockResolvedValue({ data: { updated: 1 } });
  });

  it("opens create voucher modal from transaction row action", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BankTransactions />);

    await screen.findByText("Leverantörsbetalning");
    await user.click(screen.getByRole("button", { name: "Skapa verifikat" }));

    expect(screen.getByText("Skapa verifikat från transaktion")).toBeInTheDocument();
    expect(screen.getByLabelText("Bankkonto")).toBeInTheDocument();
    expect(screen.getByLabelText("Motkonto")).toBeInTheDocument();
    expect(screen.getByLabelText("Beskrivning")).toBeInTheDocument();
  });

  it("shows validation error and blocks submit when account numbers are not 4 digits", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BankTransactions />);

    await screen.findByText("Leverantörsbetalning");
    await user.click(screen.getByRole("button", { name: "Skapa verifikat" }));

    const bankAccountInput = screen.getByLabelText("Bankkonto");
    await user.clear(bankAccountInput);
    await user.type(bankAccountInput, "12");

    const modal = screen.getByText("Skapa verifikat från transaktion").closest(".card");
    expect(modal).toBeTruthy();
    await user.click(within(modal as HTMLElement).getByRole("button", { name: "Skapa verifikat" }));

    expect(screen.getByText("Konton måste vara exakt 4 siffror.")).toBeInTheDocument();
    expect(mockCreateVoucherFromBankTransaction).not.toHaveBeenCalled();
  });

  it("submits valid create voucher form and closes modal on success", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BankTransactions />);

    await screen.findByText("Leverantörsbetalning");
    await user.click(screen.getByRole("button", { name: "Skapa verifikat" }));

    const descriptionInput = screen.getByLabelText("Beskrivning");
    await user.clear(descriptionInput);
    await user.type(descriptionInput, "Banktransaktion test");

    const modal = screen.getByText("Skapa verifikat från transaktion").closest(".card");
    expect(modal).toBeTruthy();
    await user.click(within(modal as HTMLElement).getByRole("button", { name: "Skapa verifikat" }));

    await waitFor(() => {
      expect(mockCreateVoucherFromBankTransaction).toHaveBeenCalledWith("org-1", "tx-1", {
        bankAccountNumber: "1930",
        counterAccountNumber: "6110",
        description: "Banktransaktion test",
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("Skapa verifikat från transaktion")).not.toBeInTheDocument();
    });
  });
});

describe("BankTransactions bulk actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetBankTransactions.mockResolvedValue({
      data: [
        {
          id: "tx-1",
          bookedAt: "2026-03-01T00:00:00.000Z",
          description: "Betalning A",
          amountOre: -10000,
          currency: "SEK",
          matchStatus: "MATCHED",
          counterpartyName: null,
          matchedVoucherId: "v-1",
        },
        {
          id: "tx-2",
          bookedAt: "2026-03-02T00:00:00.000Z",
          description: "Betalning B",
          amountOre: -20000,
          currency: "SEK",
          matchStatus: "MATCHED",
          counterpartyName: null,
          matchedVoucherId: "v-2",
        },
      ],
      total: 2,
      page: 1,
      limit: 20,
    });

    mockGetBankMatchCandidates.mockResolvedValue({ data: [] });
    mockMatchBankTransaction.mockResolvedValue({ data: {} });
    mockUnmatchBankTransaction.mockResolvedValue({ data: {} });
    mockConfirmBankTransaction.mockResolvedValue({ data: {} });
    mockCreateVoucherFromBankTransaction.mockResolvedValue({
      data: { voucher: { number: 101 } },
    });
    mockBulkConfirmBankTransactions.mockResolvedValue({ data: { updated: 2 } });
    mockBulkUnmatchBankTransactions.mockResolvedValue({ data: { updated: 2 } });
  });

  it("shows bulk action bar when checkboxes are selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BankTransactions />);

    await screen.findByText("Betalning A");

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThanOrEqual(3); // select-all + 2 rows

    // Select first row
    await user.click(checkboxes[1]!);

    expect(screen.getByText("1 valda")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bekräfta valda" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Avmatcha valda" })).toBeInTheDocument();
  });

  it("selects all with header checkbox", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BankTransactions />);

    await screen.findByText("Betalning A");

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]!); // select-all

    expect(screen.getByText("2 valda")).toBeInTheDocument();
  });

  it("calls bulk confirm when clicking confirm selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BankTransactions />);

    await screen.findByText("Betalning A");

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]!); // select-all

    await user.click(screen.getByRole("button", { name: "Bekräfta valda" }));

    await waitFor(() => {
      expect(mockBulkConfirmBankTransactions).toHaveBeenCalledWith(
        "org-1",
        expect.arrayContaining(["tx-1", "tx-2"]),
      );
    });
  });

  it("clears selection when clicking clear button", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BankTransactions />);

    await screen.findByText("Betalning A");

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]!);

    expect(screen.getByText("2 valda")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Avmarkera alla" }));

    expect(screen.queryByText("2 valda")).not.toBeInTheDocument();
  });
});
