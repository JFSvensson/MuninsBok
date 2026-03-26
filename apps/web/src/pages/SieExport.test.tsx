import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1", name: "Test AB" },
    fiscalYear: { id: "fy-1", startDate: "2024-01-01", endDate: "2024-12-31" },
  }),
}));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: {
      ...actual.api,
      importSie: vi.fn(),
      exportSie: vi.fn().mockReturnValue("https://example.com/export"),
    },
  };
});

vi.mock("@muninsbok/core/sie", () => ({
  decodeSieFile: vi.fn().mockReturnValue("decoded content"),
}));

import { SieExport } from "./SieExport";

describe("SieExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders heading", () => {
    renderWithProviders(<SieExport />);
    expect(
      screen.getByRole("heading", { level: 2, name: "SIE Import/Export" }),
    ).toBeInTheDocument();
  });

  it("renders description", () => {
    renderWithProviders(<SieExport />);
    expect(screen.getByText(/standardformat för att utbyta bokföringsdata/)).toBeInTheDocument();
  });

  it("renders export section", () => {
    renderWithProviders(<SieExport />);
    expect(screen.getByRole("heading", { level: 3, name: "Exportera" })).toBeInTheDocument();
    expect(screen.getByText("Ladda ner SIE-fil")).toBeInTheDocument();
  });

  it("renders import section", () => {
    renderWithProviders(<SieExport />);
    expect(screen.getByRole("heading", { level: 3, name: "Importera" })).toBeInTheDocument();
    expect(screen.getByText(/Importera verifikat från en SIE-fil/)).toBeInTheDocument();
  });

  it("renders file input for import", () => {
    renderWithProviders(<SieExport />);
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("accept", ".se,.sie,.si");
  });
});
