import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseBody } from "./parse-body.js";
import { AppError } from "./app-error.js";

const testSchema = z.object({
  name: z.string().min(1, "Namn krävs"),
  age: z.number().int().positive("Måste vara positivt"),
});

describe("parseBody", () => {
  it("returns parsed data for valid input", () => {
    const result = parseBody(testSchema, { name: "Anna", age: 30 });
    expect(result).toEqual({ name: "Anna", age: 30 });
  });

  it("throws AppError with VALIDATION_ERROR code on invalid input", () => {
    expect(() => parseBody(testSchema, { name: "", age: -1 })).toThrow(AppError);

    try {
      parseBody(testSchema, { name: "", age: -1 });
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(400);
      expect(appErr.code).toBe("VALIDATION_ERROR");
      expect(appErr.message).toContain("Namn krävs");
      expect(appErr.message).toContain("Måste vara positivt");
    }
  });

  it("throws AppError for missing required fields", () => {
    expect(() => parseBody(testSchema, {})).toThrow(AppError);
  });

  it("throws AppError for completely wrong input", () => {
    expect(() => parseBody(testSchema, "not an object")).toThrow(AppError);
  });
});
