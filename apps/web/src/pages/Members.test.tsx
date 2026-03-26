import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/test-utils";

const { mockGetMembers, mockAddToast } = vi.hoisted(() => ({
  mockGetMembers: vi.fn(),
  mockAddToast: vi.fn(),
}));

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1", name: "Test AB" },
  }),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "admin@test.se", name: "Admin" },
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
      getMembers: mockGetMembers,
      addMember: vi.fn(),
      updateMemberRole: vi.fn(),
      removeMember: vi.fn(),
    },
  };
});

import { Members } from "./Members";

const baseMembers = {
  data: [
    {
      id: "m-1",
      userId: "user-1",
      role: "OWNER" as const,
      user: { name: "Admin", email: "admin@test.se" },
    },
    {
      id: "m-2",
      userId: "user-2",
      role: "MEMBER" as const,
      user: { name: "Anna Svensson", email: "anna@test.se" },
    },
    {
      id: "m-3",
      userId: "user-3",
      role: "ADMIN" as const,
      user: { name: "Erik Karlsson", email: "erik@test.se" },
    },
  ],
};

describe("Members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGetMembers.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<Members />);
    expect(screen.getByText(/Laddar medlemmar/)).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockGetMembers.mockRejectedValue(new Error("Nätverksfel"));
    renderWithProviders(<Members />);
    expect(await screen.findByText(/Nätverksfel/)).toBeInTheDocument();
  });

  it("renders heading and add-member button", async () => {
    mockGetMembers.mockResolvedValue(baseMembers);
    renderWithProviders(<Members />);
    expect(await screen.findByRole("heading", { level: 2, name: /Medlemmar/ })).toBeInTheDocument();
    expect(screen.getByText("Lägg till medlem")).toBeInTheDocument();
  });

  it("renders member names and emails", async () => {
    mockGetMembers.mockResolvedValue(baseMembers);
    renderWithProviders(<Members />);
    expect(await screen.findByText("Anna Svensson")).toBeInTheDocument();
    expect(screen.getByText("anna@test.se")).toBeInTheDocument();
    expect(screen.getByText("Erik Karlsson")).toBeInTheDocument();
    expect(screen.getByText("erik@test.se")).toBeInTheDocument();
  });

  it("renders role labels", async () => {
    mockGetMembers.mockResolvedValue(baseMembers);
    renderWithProviders(<Members />);
    await screen.findByText("Anna Svensson");
    expect(screen.getByText("Ägare")).toBeInTheDocument();
    expect(screen.getByText("Administratör")).toBeInTheDocument();
    expect(screen.getAllByText("Medlem").length).toBeGreaterThanOrEqual(1);
  });

  it("does not show action buttons for current user", async () => {
    mockGetMembers.mockResolvedValue(baseMembers);
    renderWithProviders(<Members />);
    await screen.findByText("Anna Svensson");
    // Current user (Admin, user-1) should not have Ändra/Ta bort buttons
    // Other members should have them
    const changeButtons = screen.getAllByText("Ändra");
    expect(changeButtons.length).toBe(2); // For user-2 and user-3, not user-1
  });

  it("shows add-member dialog when button is clicked", async () => {
    mockGetMembers.mockResolvedValue(baseMembers);
    const user = userEvent.setup();
    renderWithProviders(<Members />);
    await screen.findByText("Anna Svensson");
    await user.click(screen.getByRole("button", { name: "Lägg till medlem" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("E-postadress")).toBeInTheDocument();
    expect(screen.getByLabelText("Roll")).toBeInTheDocument();
  });

  it("shows empty state when no members", async () => {
    mockGetMembers.mockResolvedValue({ data: [] });
    renderWithProviders(<Members />);
    expect(await screen.findByText("Inga medlemmar hittades.")).toBeInTheDocument();
  });

  it("renders table headers", async () => {
    mockGetMembers.mockResolvedValue(baseMembers);
    renderWithProviders(<Members />);
    await screen.findByText("Anna Svensson");
    expect(screen.getByText("Namn")).toBeInTheDocument();
    expect(screen.getByText("E-post")).toBeInTheDocument();
    expect(screen.getByText("Roll")).toBeInTheDocument();
  });
});
