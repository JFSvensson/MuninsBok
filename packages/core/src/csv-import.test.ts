import { describe, it, expect } from "vitest";
import { parseCsv, mapCsvToTransactions, type CsvColumnMapping } from "./csv-import.js";

describe("parseCsv", () => {
  it("parses semicolon-delimited CSV", () => {
    const csv = "Datum;Text;Belopp\n2024-01-15;Hyra;-5000,00\n2024-02-01;Försäljning;10000,50";
    const result = parseCsv(csv);

    expect(result.headers).toEqual(["Datum", "Text", "Belopp"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]!.values).toEqual(["2024-01-15", "Hyra", "-5000,00"]);
  });

  it("parses comma-delimited CSV", () => {
    const csv = "Date,Description,Amount\n2024-01-15,Office rent,-5000.00";
    const result = parseCsv(csv);

    expect(result.headers).toEqual(["Date", "Description", "Amount"]);
    expect(result.rows).toHaveLength(1);
  });

  it("parses tab-delimited CSV", () => {
    const csv = "Datum\tText\tBelopp\n2024-01-15\tHyra\t-5000";
    const result = parseCsv(csv);

    expect(result.headers).toEqual(["Datum", "Text", "Belopp"]);
    expect(result.rows).toHaveLength(1);
  });

  it("handles quoted fields with commas", () => {
    const csv = 'Datum;Text;Belopp\n2024-01-15;"Hyra, kontor";-5000';
    const result = parseCsv(csv);

    expect(result.rows[0]!.values[1]).toBe("Hyra, kontor");
  });

  it("handles quoted fields with embedded quotes", () => {
    const csv = 'Datum;Text;Belopp\n2024-01-15;"Faktura ""123""";-5000';
    const result = parseCsv(csv);

    expect(result.rows[0]!.values[1]).toBe('Faktura "123"');
  });

  it("returns empty for empty input", () => {
    const result = parseCsv("");
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it("handles Windows line endings", () => {
    const csv = "Datum;Text;Belopp\r\n2024-01-15;Hyra;-5000\r\n2024-02-01;Lön;-25000";
    const result = parseCsv(csv);

    expect(result.rows).toHaveLength(2);
  });

  it("skips empty lines", () => {
    const csv = "Datum;Text;Belopp\n\n2024-01-15;Hyra;-5000\n\n";
    const result = parseCsv(csv);

    expect(result.rows).toHaveLength(1);
  });
});

describe("mapCsvToTransactions", () => {
  const mapping: CsvColumnMapping = {
    dateColumn: 0,
    descriptionColumn: 1,
    amountColumn: 2,
  };

  it("maps Swedish date and amount formats", () => {
    const parsed = parseCsv("Datum;Text;Belopp\n2024-01-15;Hyra;-5 000,00");
    const result = mapCsvToTransactions(parsed, mapping);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toEqual({
      date: "2024-01-15",
      description: "Hyra",
      amount: -500000,
    });
    expect(result.errors).toHaveLength(0);
  });

  it("handles YYYYMMDD date format", () => {
    const parsed = parseCsv("Datum;Text;Belopp\n20240115;Hyra;-5000");
    const result = mapCsvToTransactions(parsed, mapping);

    expect(result.transactions[0]!.date).toBe("2024-01-15");
  });

  it("handles DD/MM/YYYY date format", () => {
    const parsed = parseCsv("Datum;Text;Belopp\n15/01/2024;Hyra;-5000");
    const result = mapCsvToTransactions(parsed, mapping);

    expect(result.transactions[0]!.date).toBe("2024-01-15");
  });

  it("handles European amount format (1.234,56)", () => {
    const parsed = parseCsv("Datum;Text;Belopp\n2024-01-15;Försäljning;1.234,56");
    const result = mapCsvToTransactions(parsed, mapping);

    expect(result.transactions[0]!.amount).toBe(123456);
  });

  it("collects errors for invalid dates", () => {
    const parsed = parseCsv("Datum;Text;Belopp\nXYZ;Hyra;-5000");
    const result = mapCsvToTransactions(parsed, mapping);

    expect(result.transactions).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.row).toBe(2);
    expect(result.errors[0]!.message).toContain("datum");
  });

  it("collects errors for missing descriptions", () => {
    const parsed = parseCsv("Datum;Text;Belopp\n2024-01-15;;-5000");
    const result = mapCsvToTransactions(parsed, mapping);

    expect(result.transactions).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain("Beskrivning");
  });

  it("collects errors for invalid amounts", () => {
    const parsed = parseCsv("Datum;Text;Belopp\n2024-01-15;Hyra;ABC");
    const result = mapCsvToTransactions(parsed, mapping);

    expect(result.transactions).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain("belopp");
  });

  it("collects errors for zero amounts", () => {
    const parsed = parseCsv("Datum;Text;Belopp\n2024-01-15;Hyra;0");
    const result = mapCsvToTransactions(parsed, mapping);

    expect(result.transactions).toHaveLength(0);
    expect(result.errors[0]!.message).toContain("noll");
  });

  it("handles positive and negative amounts", () => {
    const csv = "Datum;Text;Belopp\n2024-01-15;Inkomst;5000\n2024-01-16;Utgift;-3000";
    const parsed = parseCsv(csv);
    const result = mapCsvToTransactions(parsed, mapping);

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]!.amount).toBe(500000);
    expect(result.transactions[1]!.amount).toBe(-300000);
  });

  it("reports totalRows", () => {
    const csv = "Datum;Text;Belopp\n2024-01-15;A;100\n2024-01-16;B;200";
    const parsed = parseCsv(csv);
    const result = mapCsvToTransactions(parsed, mapping);

    expect(result.totalRows).toBe(2);
  });

  it("handles DD.MM.YYYY date format", () => {
    const parsed = parseCsv("Datum;Text;Belopp\n15.01.2024;Hyra;-5000");
    const result = mapCsvToTransactions(parsed, mapping);

    expect(result.transactions[0]!.date).toBe("2024-01-15");
  });
});
