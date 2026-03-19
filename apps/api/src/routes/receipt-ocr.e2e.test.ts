import type { IDocumentStorage } from "@muninsbok/core/types";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { Repositories } from "../repositories.js";
import type { IAggregatorBankAdapter } from "../services/bank-adapter.js";
import { TesseractReceiptOcrService } from "../services/receipt-ocr.js";
import {
  createMockBankAdapter,
  createMockDocumentStorage,
  createMockRepos,
} from "../test/helpers.js";

describe("Receipt OCR API (integration)", () => {
  it("returns OCR_PDF_CONVERTER_NOT_FOUND when PDF OCR is enabled but converter is missing", async () => {
    const previousPdfFlag = process.env["OCR_ENABLE_PDF"];
    const previousConverterBin = process.env["OCR_PDF_CONVERTER_BIN"];

    process.env["OCR_ENABLE_PDF"] = "true";
    process.env["OCR_PDF_CONVERTER_BIN"] = "__muninsbok_missing_pdftoppm__";

    const repos = createMockRepos();
    const documentStorage = createMockDocumentStorage();
    const bankAdapter = createMockBankAdapter();
    const app = await buildApp({
      repos: repos as unknown as Repositories,
      documentStorage: documentStorage as unknown as IDocumentStorage,
      receiptOcr: new TesseractReceiptOcrService(),
      bankAdapter: bankAdapter as unknown as IAggregatorBankAdapter,
    });

    try {
      const boundary = "----muninsbok-ocr-pdf";
      const payload =
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="kvitto.pdf"\r\n` +
        `Content-Type: application/pdf\r\n\r\n` +
        `%PDF-1.4\n%mock\r\n` +
        `--${boundary}--\r\n`;

      const res = await app.inject({
        method: "POST",
        url: "/api/organizations/org-1/receipt-ocr/analyze",
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      });

      expect(res.statusCode).toBe(500);
      const body = res.json();
      expect(body.code).toBe("OCR_PDF_CONVERTER_NOT_FOUND");
    } finally {
      await app.close();
      if (previousPdfFlag === undefined) delete process.env["OCR_ENABLE_PDF"];
      else process.env["OCR_ENABLE_PDF"] = previousPdfFlag;

      if (previousConverterBin === undefined) delete process.env["OCR_PDF_CONVERTER_BIN"];
      else process.env["OCR_PDF_CONVERTER_BIN"] = previousConverterBin;
    }
  });
});
