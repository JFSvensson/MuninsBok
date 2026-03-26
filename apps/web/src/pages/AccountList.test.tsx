import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/test-utils";

const { mockGetAccounts, mockDeactivateAccount, mockCreateAccount, mockUpdateAccount } = vi.hoisted(
  () => ({
    mockGetAccounts: vi.fn(),
    mockDeactivateAccount: vi.fn(),
    mockCreateAccount: vi.fn(),
    mockUpdateAccount: vi.fn(),
  }),
);

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
      deactivateAccount: mockDeactivateAccount,
      createAccount: mockCreateAccount,
      updateAccount: mockUpdateAccount,
    },
  };
});

import { AccountList } from "./AccountList";

const baseAccounts = {
  data: [
    {
      number: "1930",
      name: "Företagskonto",
      type: "ASSET" as const,
      isVatAccount: false,
      isActive: true,
    },
    {
      number: "3000",
      name: "Försäljning",
      type: "REVENUE" as const,
      isVatAccount: false,
      isActive: true,
    },
    {
      number: "5010",
      name: "Lokalhyra",
      type: "EXPENSE" as const,
      isVatAccount: false,
      isActive: true,
    },
    {
      number: "2640",
      name: "Ingående moms",
      type: "LIABILITY" as const,
      isVatAccount: true,
      isActive: true,
    },
  ],
};

describe("AccountList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGetAccounts.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<AccountList />);
    expect(screen.getByText("Laddar konton...")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockGetAccounts.mockRejectedValue(new Error("Databasfel"));
    renderWithProviders(<AccountList />);
    expect(await screen.findByText(/Databasfel/)).toBeInTheDocument();
  });

  it("renders heading and new-account button", async () => {
    mockGetAccounts.mockResolvedValue(baseAccounts);
    renderWithProviders(<AccountList />);
    expect(await screen.findByRole("heading", { level: 2, name: /Kontoplan/ })).toBeInTheDocument();
    expect(screen.getByText("+ Nytt konto")).toBeInTheDocument();
  });

  it("renders account rows", async () => {
    mockGetAccounts.mockResolvedValue(baseAccounts);
    renderWithProviders(<AccountList />);
    expect(await screen.findByText("1930")).toBeInTheDocument();
    expect(screen.getByText("Företagskonto")).toBeInTheDocument();
    expect(screen.getByText("3000")).toBeInTheDocument();
    expect(screen.getByText("Försäljning")).toBeInTheDocument();
    expect(screen.getByText("5010")).toBeInTheDocument();
    expect(screen.getByText("Lokalhyra")).toBeInTheDocument();
  });

  it("renders account type labels in table cells", async () => {
    mockGetAccounts.mockResolvedValue(baseAccounts);
    renderWithProviders(<AccountList />);
    await screen.findByText("1930");
    // Type labels appear both in filter <option> and table <td>, so use getAllByText
    expect(screen.getAllByText("Tillgång").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Intäkt").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Kostnad").length).toBeGreaterThanOrEqual(2);
  });

  it("filters accounts by search", async () => {
    mockGetAccounts.mockResolvedValue(baseAccounts);
    const user = userEvent.setup();
    renderWithProviders(<AccountList />);
    await screen.findByText("1930");
    await user.type(screen.getByPlaceholderText("Sök konto..."), "hyra");
    expect(screen.getByText("Lokalhyra")).toBeInTheDocument();
    expect(screen.queryByText("Företagskonto")).not.toBeInTheDocument();
  });

  it("filters accounts by type", async () => {
    mockGetAccounts.mockResolvedValue(baseAccounts);
    const user = userEvent.setup();
    renderWithProviders(<AccountList />);
    await screen.findByText("1930");
    await user.selectOptions(screen.getByDisplayValue("Alla typer"), "ASSET");
    expect(screen.getByText("Företagskonto")).toBeInTheDocument();
    expect(screen.queryByText("Försäljning")).not.toBeInTheDocument();
  });

  it("toggles create form", async () => {
    mockGetAccounts.mockResolvedValue(baseAccounts);
    const user = userEvent.setup();
    renderWithProviders(<AccountList />);
    await screen.findByText("1930");
    await user.click(screen.getByText("+ Nytt konto"));
    expect(screen.getByText("Skapa nytt konto")).toBeInTheDocument();
    expect(screen.getByLabelText("Kontonummer")).toBeInTheDocument();
    expect(screen.getByLabelText("Kontonamn")).toBeInTheDocument();
  });

  it("shows empty state when filter has no results", async () => {
    mockGetAccounts.mockResolvedValue(baseAccounts);
    const user = userEvent.setup();
    renderWithProviders(<AccountList />);
    await screen.findByText("1930");
    await user.type(screen.getByPlaceholderText("Sök konto..."), "xyznonexistent");
    expect(screen.getByText("Inga konton hittades.")).toBeInTheDocument();
  });

  it("shows Visa inaktiva checkbox", async () => {
    mockGetAccounts.mockResolvedValue(baseAccounts);
    renderWithProviders(<AccountList />);
    await screen.findByText("1930");
    expect(screen.getByText("Visa inaktiva")).toBeInTheDocument();
  });
});
