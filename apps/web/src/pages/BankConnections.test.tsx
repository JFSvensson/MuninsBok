import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const {
  mockAddToast,
  mockGetBankConnections,
  mockGetBankSyncRuns,
  mockSyncBankConnection,
  mockRefreshBankConnectionAuth,
} = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockGetBankConnections: vi.fn(),
  mockGetBankSyncRuns: vi.fn(),
  mockSyncBankConnection: vi.fn(),
  mockRefreshBankConnectionAuth: vi.fn(),
}));

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1" },
  }),
}));

vi.mock("../context/ToastContext", () => ({
  useToast: () => ({ addToast: mockAddToast }),
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
      getBankConnections: mockGetBankConnections,
      getBankSyncRuns: mockGetBankSyncRuns,
      syncBankConnection: mockSyncBankConnection,
      refreshBankConnectionAuth: mockRefreshBankConnectionAuth,
    },
  };
});

import { BankConnections } from "./BankConnections";

const baseConnection = {
  id: "bc-1",
  organizationId: "org-1",
  provider: "sandbox",
  externalConnectionId: "ext-1",
  displayName: "Företagskonto",
  accountName: "Testkonto",
  currency: "SEK",
  status: "CONNECTED" as const,
  authExpiresAt: "2027-01-01T00:00:00Z",
  lastSyncedAt: "2026-03-25T10:00:00Z",
  lastErrorCode: undefined,
  lastErrorMessage: undefined,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-03-25T10:00:00Z",
};

describe("BankConnections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGetBankConnections.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<BankConnections />);

    expect(screen.getByText(/laddar/i)).toBeInTheDocument();
  });

  it("shows error state on failure", async () => {
    mockGetBankConnections.mockRejectedValue(new Error("Network error"));
    renderWithProviders(<BankConnections />);

    expect(await screen.findByText(/Network error/)).toBeInTheDocument();
  });

  it("renders empty state when no connections", async () => {
    mockGetBankConnections.mockResolvedValue({ data: [] });
    renderWithProviders(<BankConnections />);

    expect(
      await screen.findByRole("heading", { level: 2, name: /Bankkopplingar/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Inga bankkopplingar/)).toBeInTheDocument();
  });

  it("renders connection card with details", async () => {
    mockGetBankConnections.mockResolvedValue({ data: [baseConnection] });
    mockGetBankSyncRuns.mockResolvedValue({ data: [] });
    renderWithProviders(<BankConnections />);

    expect(await screen.findByText("Företagskonto")).toBeInTheDocument();
    expect(screen.getByText(/sandbox/)).toBeInTheDocument();
    expect(screen.getByText(/SEK/)).toBeInTheDocument();
  });

  it("renders sync and refresh buttons", async () => {
    mockGetBankConnections.mockResolvedValue({ data: [baseConnection] });
    mockGetBankSyncRuns.mockResolvedValue({ data: [] });
    renderWithProviders(<BankConnections />);

    // Wait for the connection to render
    await screen.findByText("Företagskonto");

    // Sync and auth refresh buttons (translated via i18n)
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it("renders transactions link for connection", async () => {
    mockGetBankConnections.mockResolvedValue({ data: [baseConnection] });
    mockGetBankSyncRuns.mockResolvedValue({ data: [] });
    renderWithProviders(<BankConnections />);

    await screen.findByText("Företagskonto");
    const txLink = screen.getByRole("link", { name: /transaktioner/i });
    expect(txLink).toHaveAttribute("href", "/bank/bc-1/transactions");
  });

  it("shows error banner when connection has error", async () => {
    mockGetBankConnections.mockResolvedValue({
      data: [
        {
          ...baseConnection,
          status: "FAILED",
          lastErrorMessage: "Auth token expired",
        },
      ],
    });
    mockGetBankSyncRuns.mockResolvedValue({ data: [] });
    renderWithProviders(<BankConnections />);

    expect(await screen.findByText("Auth token expired")).toBeInTheDocument();
  });
});
