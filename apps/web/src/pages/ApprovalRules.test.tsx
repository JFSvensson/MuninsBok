import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetApprovalRules, mockAddToast } = vi.hoisted(() => ({
  mockGetApprovalRules: vi.fn(),
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

vi.mock("../hooks/useDialogFocus", () => ({
  useDialogFocus: () => ({ current: null }),
}));

vi.mock("../components/Dialog.module.css", () => ({ default: {} }));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: {
      ...actual.api,
      getApprovalRules: mockGetApprovalRules,
      createApprovalRule: vi.fn(),
      updateApprovalRule: vi.fn(),
      deleteApprovalRule: vi.fn(),
    },
  };
});

import { ApprovalRules } from "./ApprovalRules";

const baseRules = {
  data: [
    {
      id: "rule-1",
      name: "Standard",
      minAmount: 0,
      maxAmount: 500000,
      requiredRole: "ADMIN",
      stepOrder: 1,
      organizationId: "org-1",
    },
    {
      id: "rule-2",
      name: "Stor transaktion",
      minAmount: 500000,
      maxAmount: null,
      requiredRole: "OWNER",
      stepOrder: 2,
      organizationId: "org-1",
    },
  ],
};

describe("ApprovalRules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGetApprovalRules.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<ApprovalRules />);
    expect(screen.getByText("Laddar…")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockGetApprovalRules.mockRejectedValue(new Error("Serverfel"));
    renderWithProviders(<ApprovalRules />);
    expect(await screen.findByText("Serverfel")).toBeInTheDocument();
  });

  it("renders heading and new rule button", async () => {
    mockGetApprovalRules.mockResolvedValue(baseRules);
    renderWithProviders(<ApprovalRules />);
    expect(
      await screen.findByRole("heading", { level: 2, name: "Attestregler" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ny attestregel")).toBeInTheDocument();
  });

  it("shows empty state when no rules", async () => {
    mockGetApprovalRules.mockResolvedValue({ data: [] });
    renderWithProviders(<ApprovalRules />);
    expect(await screen.findByText("Inga attestregler har skapats.")).toBeInTheDocument();
  });

  it("renders rule rows with data", async () => {
    mockGetApprovalRules.mockResolvedValue(baseRules);
    renderWithProviders(<ApprovalRules />);
    expect(await screen.findByText("Standard")).toBeInTheDocument();
    expect(screen.getByText("Stor transaktion")).toBeInTheDocument();
    expect(screen.getByText("Administratör")).toBeInTheDocument();
    expect(screen.getByText("Ägare")).toBeInTheDocument();
  });

  it("renders table headers", async () => {
    mockGetApprovalRules.mockResolvedValue(baseRules);
    renderWithProviders(<ApprovalRules />);
    await screen.findByText("Standard");
    expect(screen.getByText("Stegordning")).toBeInTheDocument();
    expect(screen.getByText("Regelnamn")).toBeInTheDocument();
    expect(screen.getByText("Minsta belopp (kr)")).toBeInTheDocument();
  });

  it("shows 'Inget tak' for null maxAmount", async () => {
    mockGetApprovalRules.mockResolvedValue(baseRules);
    renderWithProviders(<ApprovalRules />);
    await screen.findByText("Standard");
    expect(screen.getByText("Inget tak")).toBeInTheDocument();
  });

  it("renders edit and delete buttons per rule", async () => {
    mockGetApprovalRules.mockResolvedValue(baseRules);
    renderWithProviders(<ApprovalRules />);
    await screen.findByText("Standard");
    expect(screen.getAllByText("Redigera").length).toBe(2);
    expect(screen.getAllByText("Ta bort").length).toBe(2);
  });
});
