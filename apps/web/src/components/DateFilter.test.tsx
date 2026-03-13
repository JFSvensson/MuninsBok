import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateFilter } from "./DateFilter";

describe("DateFilter", () => {
  const onFilter = vi.fn();

  beforeEach(() => {
    onFilter.mockClear();
  });

  it("renders two date inputs and a disabled filter button", () => {
    render(<DateFilter onFilter={onFilter} />);
    const inputs = document.querySelectorAll('input[type="date"]');
    expect(inputs).toHaveLength(2);
    expect(screen.getByText("Filtrera")).toBeDisabled();
  });

  it("enables filter button when both dates are filled", async () => {
    const user = userEvent.setup();
    render(<DateFilter onFilter={onFilter} />);

    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    await user.type(inputs[0]!, "2025-01-01");
    await user.type(inputs[1]!, "2025-12-31");

    expect(screen.getByText("Filtrera")).toBeEnabled();
  });

  it("calls onFilter with date range on submit", async () => {
    const user = userEvent.setup();
    render(<DateFilter onFilter={onFilter} />);

    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    await user.type(inputs[0]!, "2025-01-01");
    await user.type(inputs[1]!, "2025-12-31");
    await user.click(screen.getByText("Filtrera"));

    expect(onFilter).toHaveBeenCalledWith({
      startDate: "2025-01-01",
      endDate: "2025-12-31",
    });
  });

  it("shows clear button when a date is entered", async () => {
    const user = userEvent.setup();
    render(<DateFilter onFilter={onFilter} />);

    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    await user.type(inputs[0]!, "2025-01-01");

    expect(screen.getByText("Rensa")).toBeInTheDocument();
  });

  it("clears dates and calls onFilter(undefined) when clear is clicked", async () => {
    const user = userEvent.setup();
    render(<DateFilter onFilter={onFilter} />);

    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    await user.type(inputs[0]!, "2025-01-01");
    await user.type(inputs[1]!, "2025-12-31");
    await user.click(screen.getByText("Rensa"));

    expect(onFilter).toHaveBeenCalledWith(undefined);
    expect(inputs[0]!.value).toBe("");
    expect(inputs[1]!.value).toBe("");
  });

  it("does not show clear button when no dates are entered", () => {
    render(<DateFilter onFilter={onFilter} />);
    expect(screen.queryByText("Rensa")).not.toBeInTheDocument();
  });
});
