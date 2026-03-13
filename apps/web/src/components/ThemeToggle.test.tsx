import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./ThemeToggle";

// Mock the ThemeContext module
const mockSetTheme = vi.fn();
let currentTheme: "system" | "dark" | "light" = "system";

vi.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: currentTheme,
    resolvedTheme: currentTheme === "system" ? "light" : currentTheme,
    setTheme: mockSetTheme,
  }),
}));

// CSS modules return class names as-is in tests
vi.mock("./ThemeToggle.module.css", () => ({ default: { toggle: "toggle" } }));

import { renderWithProviders } from "../test/test-utils";

describe("ThemeToggle", () => {
  beforeEach(() => {
    currentTheme = "system";
    mockSetTheme.mockClear();
  });

  it("renders a button with the correct aria-label for system theme", () => {
    renderWithProviders(<ThemeToggle />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Systemtema");
  });

  it("shows computer icon for system theme", () => {
    renderWithProviders(<ThemeToggle />);
    expect(screen.getByRole("button")).toHaveTextContent("🖥");
  });

  it("shows moon icon for dark theme", () => {
    currentTheme = "dark";
    renderWithProviders(<ThemeToggle />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Mörkt tema");
  });

  it("shows sun icon for light theme", () => {
    currentTheme = "light";
    renderWithProviders(<ThemeToggle />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Ljust tema");
  });

  it("cycles system → dark on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle />);

    await user.click(screen.getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("cycles dark → light on click", async () => {
    currentTheme = "dark";
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle />);

    await user.click(screen.getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("cycles light → system on click", async () => {
    currentTheme = "light";
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle />);

    await user.click(screen.getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("system");
  });
});
