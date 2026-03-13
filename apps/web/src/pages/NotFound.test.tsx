import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";
import { NotFound } from "./NotFound";

describe("NotFound", () => {
  it("renders 404 heading", () => {
    renderWithProviders(<NotFound />);
    expect(screen.getByText(/Sidan hittades inte/)).toBeInTheDocument();
  });

  it("renders descriptive message", () => {
    renderWithProviders(<NotFound />);
    expect(screen.getByText("Sidan du söker finns inte.")).toBeInTheDocument();
  });

  it("renders a link to the dashboard", () => {
    renderWithProviders(<NotFound />);
    const link = screen.getByText("Tillbaka till översikten").closest("a");
    expect(link).toHaveAttribute("href", "/dashboard");
  });
});
