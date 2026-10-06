import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../test/helpers.js";

// buildTestApp does not pass corsOrigin, so the app uses the
// default origin http://localhost:5173 with credentials enabled.
describe("CORS plugin", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
  });

  it("sets Access-Control-Allow-Origin to the configured origin", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "http://localhost:5173" },
    });
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("sets Access-Control-Allow-Origin even for other origins (single static value)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://evil.example.com" },
    });
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("sets Access-Control-Allow-Origin without an origin header", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("responds to preflight OPTIONS with 204 and allow headers", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/health",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
    expect(res.headers["access-control-allow-headers"]).toBe("content-type");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});
