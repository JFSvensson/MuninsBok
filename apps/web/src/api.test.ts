import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiError } from "./api";

describe("ApiError", () => {
  it("creates error with status, code and message", () => {
    const error = new ApiError(404, "NOT_FOUND", "Organization not found");

    expect(error.status).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Organization not found");
    expect(error.name).toBe("ApiError");
  });

  it("is instance of Error", () => {
    const error = new ApiError(500, "INTERNAL", "Server error");
    expect(error).toBeInstanceOf(Error);
  });

  describe("isNotFound", () => {
    it("returns true for 404", () => {
      expect(new ApiError(404, "NOT_FOUND", "").isNotFound).toBe(true);
    });

    it("returns false for non-404", () => {
      expect(new ApiError(400, "BAD_REQUEST", "").isNotFound).toBe(false);
      expect(new ApiError(500, "INTERNAL", "").isNotFound).toBe(false);
    });
  });

  describe("isValidationError", () => {
    it("returns true for 400", () => {
      expect(new ApiError(400, "BAD_REQUEST", "").isValidationError).toBe(true);
    });

    it("returns false for non-400", () => {
      expect(new ApiError(404, "NOT_FOUND", "").isValidationError).toBe(false);
      expect(new ApiError(500, "INTERNAL", "").isValidationError).toBe(false);
    });
  });

  describe("isServerError", () => {
    it("returns true for 500+", () => {
      expect(new ApiError(500, "INTERNAL", "").isServerError).toBe(true);
      expect(new ApiError(502, "BAD_GATEWAY", "").isServerError).toBe(true);
      expect(new ApiError(503, "UNAVAILABLE", "").isServerError).toBe(true);
    });

    it("returns false for client errors", () => {
      expect(new ApiError(400, "BAD_REQUEST", "").isServerError).toBe(false);
      expect(new ApiError(404, "NOT_FOUND", "").isServerError).toBe(false);
      expect(new ApiError(422, "UNPROCESSABLE", "").isServerError).toBe(false);
    });
  });
});

describe("fetchJson", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("throws ApiError on non-ok response", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: "Not found" }),
    });

    // Import dynamically to use mocked fetch
    const { api } = await import("./api");

    await expect(api.getOrganizations()).rejects.toThrow(ApiError);
  });

  it("returns parsed JSON on success", async () => {
    const mockData = { data: [{ id: "1", name: "Test" }] };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const { api } = await import("./api");
    const result = await api.getOrganizations();

    expect(result).toEqual(mockData);
  });
});
