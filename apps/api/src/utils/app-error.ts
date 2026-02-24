/**
 * Structured application error.
 *
 * Throw `AppError` anywhere in a route handler and the global error
 * handler will format it as a consistent JSON response:
 *
 *   { error, code, statusCode, requestId }
 *
 * Keeps error creation DRY and ensures a single error shape across the API.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }

  /* ── Factory methods ─────────────────────────────── */

  /** 400 — generic bad request */
  static badRequest(message: string, code = "BAD_REQUEST"): AppError {
    return new AppError(400, code, message);
  }

  /** 400 — Zod / schema validation failure */
  static validation(message: string): AppError {
    return new AppError(400, "VALIDATION_ERROR", message);
  }

  /** 404 — entity not found */
  static notFound(entity: string): AppError {
    return new AppError(404, "NOT_FOUND", `${entity} hittades inte`);
  }

  /** 409 — duplicate / conflict */
  static conflict(message: string): AppError {
    return new AppError(409, "CONFLICT", message);
  }

  /** 500 — unexpected server error */
  static internal(message = "Internt serverfel"): AppError {
    return new AppError(500, "INTERNAL_ERROR", message);
  }
}
