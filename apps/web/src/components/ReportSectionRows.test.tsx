import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportSectionRows } from "./ReportSectionRows";

describe("ReportSectionRows", () => {
  const section = {
    title: "Intäkter",
    rows: [
      { accountNumber: "3000", accountName: "Försäljning", amount: 150000 },
      { accountNumber: "3010", accountName: "Tjänsteintäkter", amount: 50000 },
    ],
    total: 200000,
  };

  function renderInTable(ui: React.ReactElement) {
    return render(
      <table>
        <tbody>{ui}</tbody>
      </table>,
    );
  }

  it("renders nothing for empty section", () => {
    const { container } = renderInTable(
      <ReportSectionRows section={{ title: "Tom", rows: [], total: 0 }} />,
    );
    // Only the table/tbody wrapper, no tr children
    expect(container.querySelectorAll("tr")).toHaveLength(0);
  });

  it("renders section title row", () => {
    renderInTable(<ReportSectionRows section={section} />);
    expect(screen.getByText("Intäkter")).toBeInTheDocument();
  });

  it("renders each account row", () => {
    renderInTable(<ReportSectionRows section={section} />);
    expect(screen.getByText("3000")).toBeInTheDocument();
    expect(screen.getByText("Försäljning")).toBeInTheDocument();
    expect(screen.getByText("3010")).toBeInTheDocument();
    expect(screen.getByText("Tjänsteintäkter")).toBeInTheDocument();
  });

  it("renders formatted amounts", () => {
    renderInTable(<ReportSectionRows section={section} />);
    // formatAmount formats numbers with Swedish locale (space as thousands separator)
    expect(screen.getByText("150 000,00")).toBeInTheDocument();
    expect(screen.getByText("50 000,00")).toBeInTheDocument();
  });

  it("renders summary row with total", () => {
    renderInTable(<ReportSectionRows section={section} />);
    expect(screen.getByText("Summa intäkter")).toBeInTheDocument();
    expect(screen.getByText("200 000,00")).toBeInTheDocument();
  });

  it("renders correct number of rows (title + accounts + summary)", () => {
    const { container } = renderInTable(<ReportSectionRows section={section} />);
    // 1 title + 2 accounts + 1 summary = 4 rows
    expect(container.querySelectorAll("tr")).toHaveLength(4);
  });
});
