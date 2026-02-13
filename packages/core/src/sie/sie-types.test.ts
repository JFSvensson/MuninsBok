import { describe, it, expect } from "vitest";
import { createEmptySieFile } from "./types.js";
import type { SieExportOptions } from "./types.js";

describe("createEmptySieFile", () => {
  const baseOptions: SieExportOptions = {
    companyName: "Testföretag AB",
    orgNumber: "5560360793",
  };

  it("should create a valid SIE4 file structure", () => {
    const file = createEmptySieFile(baseOptions);
    expect(file.flag).toBe(0);
    expect(file.format).toBe("PC8");
    expect(file.sieType).toBe(4);
  });

  it("should set company name and org number", () => {
    const file = createEmptySieFile(baseOptions);
    expect(file.companyName).toBe("Testföretag AB");
    expect(file.orgNumber).toBe("5560360793");
  });

  it("should default program to Munins bok", () => {
    const file = createEmptySieFile(baseOptions);
    expect(file.program.name).toBe("Munins bok");
    expect(file.program.version).toBe("0.1.0");
  });

  it("should use custom program name and version when provided", () => {
    const file = createEmptySieFile({
      ...baseOptions,
      programName: "CustomApp",
      programVersion: "2.0.0",
    });
    expect(file.program.name).toBe("CustomApp");
    expect(file.program.version).toBe("2.0.0");
  });

  it("should set generation date to approximately now", () => {
    const before = Date.now();
    const file = createEmptySieFile(baseOptions);
    const after = Date.now();
    const genTime = file.generated.date.getTime();
    expect(genTime).toBeGreaterThanOrEqual(before);
    expect(genTime).toBeLessThanOrEqual(after);
  });

  it("should not set generation signature", () => {
    const file = createEmptySieFile(baseOptions);
    expect(file.generated.signature).toBeUndefined();
  });

  it("should initialize all arrays as empty", () => {
    const file = createEmptySieFile(baseOptions);
    expect(file.fiscalYears).toEqual([]);
    expect(file.accounts).toEqual([]);
    expect(file.openingBalances).toEqual([]);
    expect(file.closingBalances).toEqual([]);
    expect(file.resultBalances).toEqual([]);
    expect(file.vouchers).toEqual([]);
  });

  it("should work without org number", () => {
    const file = createEmptySieFile({ companyName: "Förening X" });
    expect(file.companyName).toBe("Förening X");
    expect(file.orgNumber).toBeUndefined();
  });
});
