import { describe, it, expect } from "vitest";
import { AppError } from "./app-error.js";

describe("AppError", () => {
  it("creates a bad-request error", () => {
    const err = AppError.badRequest("Ogiltigt fält");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toBe("Ogiltigt fält");
    expect(err).toBeInstanceOf(Error);
  });

  it("creates a validation error", () => {
    const err = AppError.validation("Saknar obligatoriskt fält");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
  });

  it("creates a not-found error with entity name", () => {
    const err = AppError.notFound("Verifikatet");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Verifikatet hittades inte");
  });

  it("creates a conflict error", () => {
    const err = AppError.conflict("Organisationsnumret finns redan");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });

  it("creates an internal error with default message", () => {
    const err = AppError.internal();
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err.message).toBe("Internt serverfel");
  });

  it("allows custom code for bad-request", () => {
    const err = AppError.badRequest("Saknar fiscalYearId", "MISSING_PARAM");
    expect(err.code).toBe("MISSING_PARAM");
  });
});
