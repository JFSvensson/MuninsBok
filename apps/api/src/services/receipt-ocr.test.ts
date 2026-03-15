import { describe, expect, it } from "vitest";
import {
  TesseractReceiptOcrService,
  parseReceiptText,
  supportsReceiptOcrMimeType,
} from "./receipt-ocr.js";

describe("receipt OCR parsing", () => {
  it("extracts merchant, date and total from common Swedish receipt text", () => {
    const result = parseReceiptText({
      sourceFilename: "ica-kvitto.jpg",
      mimeType: "image/jpeg",
      confidence: 87,
      extractedText: [
        "ICA Nara Torsgatan",
        "Datum 2025-01-17 14:33",
        "Moms 25% 24,69",
        "Summa att betala 123,45",
      ].join("\n"),
    });

    expect(result.merchantName).toBe("ICA Nara Torsgatan");
    expect(result.transactionDate).toBe("2025-01-17");
    expect(result.totalAmountOre).toBe(12345);
    expect(result.vatAmountOre).toBe(2469);
    expect(result.prefillLines).toHaveLength(2);
  });

  it("marks low-confidence parsing with warnings", () => {
    const result = parseReceiptText({
      sourceFilename: "oklart.jpg",
      mimeType: "image/jpeg",
      confidence: 32,
      extractedText: "KVITTO\nBelopp 99,00",
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.totalAmountOre).toBe(9900);
  });

  it("supports OCR only for image formats in the first version", () => {
    expect(supportsReceiptOcrMimeType("image/jpeg", { pdfEnabled: false })).toBe(true);
    expect(supportsReceiptOcrMimeType("application/pdf", { pdfEnabled: false })).toBe(false);
    expect(supportsReceiptOcrMimeType("application/pdf", { pdfEnabled: true })).toBe(true);
  });

  it("rejects PDF OCR when feature flag is disabled", async () => {
    const previous = process.env["OCR_ENABLE_PDF"];
    process.env["OCR_ENABLE_PDF"] = "false";
    const service = new TesseractReceiptOcrService();

    try {
      await expect(
        service.analyze({
          buffer: new Uint8Array([37, 80, 68, 70]),
          filename: "test.pdf",
          mimeType: "application/pdf",
        }),
      ).rejects.toMatchObject({
        code: "OCR_PDF_DISABLED",
      });
    } finally {
      if (previous === undefined) delete process.env["OCR_ENABLE_PDF"];
      else process.env["OCR_ENABLE_PDF"] = previous;
    }
  });
});
