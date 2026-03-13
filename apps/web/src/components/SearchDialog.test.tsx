import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/test-utils";
import { SearchDialog } from "./SearchDialog";

// Mock the OrganizationContext
vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1", name: "Test AB" },
    fiscalYear: { id: "fy-1" },
  }),
}));

// Mock the api module
vi.mock("../api", () => ({
  api: {
    search: vi.fn(),
  },
}));

import { api } from "../api";

describe("SearchDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = renderWithProviders(<SearchDialog open={false} onClose={() => {}} />);
    expect(container.querySelector("[role='dialog']")).toBeNull();
  });

  it("renders dialog when open", () => {
    renderWithProviders(<SearchDialog open={true} onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Sökterm")).toBeInTheDocument();
  });

  it("shows minimum character hint before typing", () => {
    renderWithProviders(<SearchDialog open={true} onClose={() => {}} />);
    expect(screen.getByText(/minst 2 tecken/)).toBeInTheDocument();
  });

  it("calls onClose when clicking overlay", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<SearchDialog open={true} onClose={onClose} />);

    // Click the overlay (the outer div with role="dialog")
    await user.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<SearchDialog open={true} onClose={onClose} />);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows navigation hints", () => {
    renderWithProviders(<SearchDialog open={true} onClose={() => {}} />);
    const hint = screen.getByText(/navigera/);
    expect(hint).toBeInTheDocument();
    expect(hint.textContent).toContain("öppna");
    expect(hint.textContent).toContain("stäng");
  });

  it("displays results when search returns data", async () => {
    const user = userEvent.setup();
    const mockSearch = api.search as ReturnType<typeof vi.fn>;
    mockSearch.mockResolvedValue({
      data: {
        query: "hyra",
        vouchers: [
          { id: "v1", number: 5, date: "2024-04-01", description: "Hyra kontor", amount: 200 },
        ],
        accounts: [{ number: "5010", name: "Lokalhyra", type: "EXPENSE" }],
        totalHits: 2,
      },
    });

    renderWithProviders(<SearchDialog open={true} onClose={() => {}} />);
    const input = screen.getByLabelText("Sökterm");
    await user.type(input, "hyra");

    // Wait for results
    expect(await screen.findByText(/Hyra kontor/)).toBeInTheDocument();
    expect(screen.getByText(/Lokalhyra/)).toBeInTheDocument();
    expect(screen.getByText("Verifikat (1)")).toBeInTheDocument();
    expect(screen.getByText("Konton (1)")).toBeInTheDocument();
  });

  it("shows no results message", async () => {
    const user = userEvent.setup();
    const mockSearch = api.search as ReturnType<typeof vi.fn>;
    mockSearch.mockResolvedValue({
      data: {
        query: "xyz",
        vouchers: [],
        accounts: [],
        totalHits: 0,
      },
    });

    renderWithProviders(<SearchDialog open={true} onClose={() => {}} />);
    await user.type(screen.getByLabelText("Sökterm"), "xyz");

    expect(await screen.findByText(/Inga träffar/)).toBeInTheDocument();
  });
});
