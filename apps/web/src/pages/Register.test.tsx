import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/test-utils";

const { mockRegister, mockNavigate } = vi.hoisted(() => ({
  mockRegister: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ register: mockRegister }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import { Register } from "./Register";
import { ApiError } from "../api";

describe("Register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders form fields", () => {
    renderWithProviders(<Register />);
    expect(screen.getByLabelText("Namn")).toBeInTheDocument();
    expect(screen.getByLabelText("E-postadress")).toBeInTheDocument();
    expect(screen.getByLabelText("Lösenord")).toBeInTheDocument();
    expect(screen.getByLabelText("Bekräfta lösenord")).toBeInTheDocument();
  });

  it("renders heading and subtitle", () => {
    renderWithProviders(<Register />);
    expect(screen.getByRole("heading", { level: 1, name: "Munins bok" })).toBeInTheDocument();
    expect(screen.getByText("Skapa ett nytt konto")).toBeInTheDocument();
  });

  it("renders submit button", () => {
    renderWithProviders(<Register />);
    expect(screen.getByRole("button", { name: "Skapa konto" })).toBeInTheDocument();
  });

  it("renders login link", () => {
    renderWithProviders(<Register />);
    expect(screen.getByText("Logga in")).toBeInTheDocument();
    expect(screen.getByText("Har du redan ett konto?")).toBeInTheDocument();
  });

  it("shows password mismatch error", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await user.type(screen.getByLabelText("Namn"), "Test");
    await user.type(screen.getByLabelText("E-postadress"), "test@test.se");
    await user.type(screen.getByLabelText("Lösenord"), "password123");
    await user.type(screen.getByLabelText("Bekräfta lösenord"), "different123");
    await user.click(screen.getByRole("button", { name: "Skapa konto" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Lösenorden matchar inte.");
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("calls register and navigates on success", async () => {
    mockRegister.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await user.type(screen.getByLabelText("Namn"), "Test User");
    await user.type(screen.getByLabelText("E-postadress"), "test@test.se");
    await user.type(screen.getByLabelText("Lösenord"), "password123");
    await user.type(screen.getByLabelText("Bekräfta lösenord"), "password123");
    await user.click(screen.getByRole("button", { name: "Skapa konto" }));
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith("test@test.se", "Test User", "password123");
    });
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("shows API error on failure", async () => {
    mockRegister.mockRejectedValue(new ApiError(409, "CONFLICT", "E-postadressen finns redan."));
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await user.type(screen.getByLabelText("Namn"), "Test");
    await user.type(screen.getByLabelText("E-postadress"), "test@test.se");
    await user.type(screen.getByLabelText("Lösenord"), "password123");
    await user.type(screen.getByLabelText("Bekräfta lösenord"), "password123");
    await user.click(screen.getByRole("button", { name: "Skapa konto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("E-postadressen finns redan.");
  });

  it("shows generic error for unexpected failures", async () => {
    mockRegister.mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await user.type(screen.getByLabelText("Namn"), "Test");
    await user.type(screen.getByLabelText("E-postadress"), "test@test.se");
    await user.type(screen.getByLabelText("Lösenord"), "password123");
    await user.type(screen.getByLabelText("Bekräfta lösenord"), "password123");
    await user.click(screen.getByRole("button", { name: "Skapa konto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ett oväntat fel uppstod");
  });
});
