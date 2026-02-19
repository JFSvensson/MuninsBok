import { describe, it, expect } from "vitest";
import { isAllowedMimeType, ALLOWED_MIME_TYPES } from "./document.js";

describe("ALLOWED_MIME_TYPES", () => {
  it("should include PDF", () => {
    expect(ALLOWED_MIME_TYPES).toContain("application/pdf");
  });

  it("should include common image formats", () => {
    expect(ALLOWED_MIME_TYPES).toContain("image/jpeg");
    expect(ALLOWED_MIME_TYPES).toContain("image/png");
    expect(ALLOWED_MIME_TYPES).toContain("image/webp");
  });

  it("should include HEIC for iPhone photos", () => {
    expect(ALLOWED_MIME_TYPES).toContain("image/heic");
  });

  it("should have exactly 5 allowed types", () => {
    expect(ALLOWED_MIME_TYPES).toHaveLength(5);
  });
});

describe("isAllowedMimeType", () => {
  describe("allowed types", () => {
    it("should return true for application/pdf", () => {
      expect(isAllowedMimeType("application/pdf")).toBe(true);
    });

    it("should return true for image/jpeg", () => {
      expect(isAllowedMimeType("image/jpeg")).toBe(true);
    });

    it("should return true for image/png", () => {
      expect(isAllowedMimeType("image/png")).toBe(true);
    });

    it("should return true for image/webp", () => {
      expect(isAllowedMimeType("image/webp")).toBe(true);
    });

    it("should return true for image/heic", () => {
      expect(isAllowedMimeType("image/heic")).toBe(true);
    });
  });

  describe("disallowed types", () => {
    it("should return false for application/zip", () => {
      expect(isAllowedMimeType("application/zip")).toBe(false);
    });

    it("should return false for text/plain", () => {
      expect(isAllowedMimeType("text/plain")).toBe(false);
    });

    it("should return false for image/gif", () => {
      expect(isAllowedMimeType("image/gif")).toBe(false);
    });

    it("should return false for image/svg+xml", () => {
      expect(isAllowedMimeType("image/svg+xml")).toBe(false);
    });

    it("should return false for application/octet-stream", () => {
      expect(isAllowedMimeType("application/octet-stream")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isAllowedMimeType("")).toBe(false);
    });

    it("should be case-sensitive (IMAGE/JPEG is not valid)", () => {
      expect(isAllowedMimeType("IMAGE/JPEG")).toBe(false);
    });
  });
});
