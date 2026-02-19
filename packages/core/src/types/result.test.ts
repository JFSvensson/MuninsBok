import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr, unwrap, unwrapOr, map, mapErr, andThen, combine } from "./result.js";
import type { Result } from "./result.js";

describe("ok", () => {
  it("should create an Ok result", () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(42);
  });

  it("should work with string values", () => {
    const result = ok("hello");
    expect(result.value).toBe("hello");
  });

  it("should work with null value", () => {
    const result = ok(null);
    expect(result.ok).toBe(true);
    expect(result.value).toBeNull();
  });
});

describe("err", () => {
  it("should create an Err result", () => {
    const result = err("something went wrong");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("something went wrong");
  });

  it("should work with structured errors", () => {
    const error = { code: "NOT_FOUND", message: "Finns inte" };
    const result = err(error);
    expect(result.error).toEqual(error);
  });
});

describe("isOk", () => {
  it("should return true for Ok", () => {
    expect(isOk(ok(1))).toBe(true);
  });

  it("should return false for Err", () => {
    expect(isOk(err("fail"))).toBe(false);
  });
});

describe("isErr", () => {
  it("should return true for Err", () => {
    expect(isErr(err("fail"))).toBe(true);
  });

  it("should return false for Ok", () => {
    expect(isErr(ok(1))).toBe(false);
  });
});

describe("unwrap", () => {
  it("should return value for Ok", () => {
    expect(unwrap(ok(42))).toBe(42);
  });

  it("should throw for Err", () => {
    expect(() => unwrap(err("boom"))).toThrow("Tried to unwrap an Err: boom");
  });

  it("should include error in thrown message", () => {
    const result = err({ code: "FAIL" });
    expect(() => unwrap(result)).toThrow("[object Object]");
  });
});

describe("unwrapOr", () => {
  it("should return value for Ok", () => {
    expect(unwrapOr(ok(42), 0)).toBe(42);
  });

  it("should return default for Err", () => {
    expect(unwrapOr(err("fail"), 0)).toBe(0);
  });

  it("should return null default for Err", () => {
    expect(unwrapOr(err("fail") as Result<string | null, string>, null)).toBeNull();
  });
});

describe("map", () => {
  it("should map Ok value", () => {
    const result = map(ok(2), (x) => x * 3);
    expect(result).toEqual(ok(6));
  });

  it("should pass through Err unchanged", () => {
    const original = err("fail");
    const result = map(original, (x: number) => x * 3);
    expect(result).toBe(original);
  });

  it("should allow type transformation", () => {
    const result = map(ok(42), (x) => String(x));
    expect(result).toEqual(ok("42"));
  });
});

describe("mapErr", () => {
  it("should map Err value", () => {
    const result = mapErr(err("fail"), (e) => `Error: ${e}`);
    expect(result).toEqual(err("Error: fail"));
  });

  it("should pass through Ok unchanged", () => {
    const original = ok(42);
    const result = mapErr(original, (e: string) => `Error: ${e}`);
    expect(result).toBe(original);
  });

  it("should allow error type transformation", () => {
    const result = mapErr(err("not_found"), (e) => ({ code: e, message: "Fel" }));
    expect(result).toEqual(err({ code: "not_found", message: "Fel" }));
  });
});

describe("andThen", () => {
  const parsePositive = (n: number): Result<number, string> =>
    n > 0 ? ok(n) : err("must be positive");

  it("should chain Ok results", () => {
    const result = andThen(ok(5), parsePositive);
    expect(result).toEqual(ok(5));
  });

  it("should short-circuit on first Err", () => {
    const result = andThen(ok(-1), parsePositive);
    expect(result).toEqual(err("must be positive"));
  });

  it("should pass through original Err", () => {
    const original = err("initial error") as Result<number, string>;
    const result = andThen(original, parsePositive);
    expect(result).toBe(original);
  });

  it("should allow chaining multiple operations", () => {
    const double = (n: number): Result<number, string> => ok(n * 2);
    const result = andThen(andThen(ok(3), parsePositive), double);
    expect(result).toEqual(ok(6));
  });
});

describe("combine", () => {
  it("should combine all Ok results into array", () => {
    const results = [ok(1), ok(2), ok(3)];
    expect(combine(results)).toEqual(ok([1, 2, 3]));
  });

  it("should return first Err if any fail", () => {
    const results: Result<number, string>[] = [ok(1), err("fail"), ok(3)];
    expect(combine(results)).toEqual(err("fail"));
  });

  it("should return first Err when multiple errors", () => {
    const results: Result<number, string>[] = [err("first"), err("second")];
    const result = combine(results);
    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error).toBe("first");
    }
  });

  it("should return Ok with empty array for empty input", () => {
    expect(combine([])).toEqual(ok([]));
  });

  it("should work with single element", () => {
    expect(combine([ok(42)])).toEqual(ok([42]));
  });
});
