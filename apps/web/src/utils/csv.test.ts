import { describe, it, expect } from "vitest";
import { toCsv, csvAmount } from "./csv";

describe("toCsv", () => {
  it("should create CSV with BOM and semicolon separator", () => {
    const result = toCsv(["Konto", "Namn"], [["1910", "Kassa"]]);

    expect(result).toContain("\uFEFF"); // BOM
    expect(result).toContain("Konto;Namn");
    expect(result).toContain("1910;Kassa");
  });

  it("should escape fields with semicolons", () => {
    const result = toCsv(["Namn"], [["Konto; special"]]);

    expect(result).toContain('"Konto; special"');
  });

  it("should escape fields with quotes", () => {
    const result = toCsv(["Namn"], [['Test "quoted"']]);

    expect(result).toContain('"Test ""quoted"""');
  });

  it("should handle empty rows", () => {
    const result = toCsv(["A", "B"], []);

    // Only header line
    const lines = result.replace("\uFEFF", "").split("\r\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe("A;B");
  });
});

describe("csvAmount", () => {
  it("should format with comma as decimal separator", () => {
    expect(csvAmount(1234.56)).toBe("1234,56");
  });

  it("should add two decimal places", () => {
    expect(csvAmount(100)).toBe("100,00");
  });

  it("should handle negative amounts", () => {
    expect(csvAmount(-42.1)).toBe("-42,10");
  });
});
