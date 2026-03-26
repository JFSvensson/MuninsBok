import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/test-utils";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: { ...actual.api, deleteOrganization: vi.fn() },
  };
});

vi.mock("../hooks/useDialogFocus", () => ({
  useDialogFocus: () => ({ current: null }),
}));

vi.mock("./Dialog.module.css", () => ({ default: {} }));

import { DeleteOrganizationDialog } from "./DeleteOrganizationDialog";

describe("DeleteOrganizationDialog", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    organizationId: "org-1",
    organizationName: "Test AB",
    onDeleted: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = renderWithProviders(
      <DeleteOrganizationDialog {...defaultProps} open={false} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders dialog with warning when open", () => {
    renderWithProviders(<DeleteOrganizationDialog {...defaultProps} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Radera organisation" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Varning!/)).toBeInTheDocument();
  });

  it("renders confirmation input", () => {
    renderWithProviders(<DeleteOrganizationDialog {...defaultProps} />);
    expect(screen.getByLabelText(/Skriv/)).toBeInTheDocument();
  });

  it("disables delete button until name matches", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeleteOrganizationDialog {...defaultProps} />);
    const deleteBtn = screen.getByRole("button", { name: "Radera organisation" });
    expect(deleteBtn).toBeDisabled();
    await user.type(screen.getByLabelText(/Skriv/), "Test AB");
    expect(deleteBtn).toBeEnabled();
  });

  it("renders cancel button", () => {
    renderWithProviders(<DeleteOrganizationDialog {...defaultProps} />);
    expect(screen.getByText("Avbryt")).toBeInTheDocument();
  });
});
