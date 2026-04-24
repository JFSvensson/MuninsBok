import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../test/helpers.js";

describe("OpenAPI / Swagger", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
  });

  it("serves OpenAPI JSON spec at /docs/json", async () => {
    const res = await app.inject({ method: "GET", url: "/docs/json" });
    expect(res.statusCode).toBe(200);

    const spec = res.json();
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info.title).toBe("Munins bok API");
  });

  it("serves Swagger UI at /docs", async () => {
    const res = await app.inject({ method: "GET", url: "/docs/" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
  });

  it("includes API routes in the OpenAPI spec", async () => {
    const res = await app.inject({ method: "GET", url: "/docs/json" });
    const spec = res.json();

    // At minimum, the org-scoped routes should be present
    const paths = Object.keys(spec.paths ?? {});
    expect(paths.length).toBeGreaterThan(0);
  });

  it("does not expose Swagger UI in production by default", async () => {
    const ctx = await buildTestApp(undefined, { isProduction: true });
    const prodApp = ctx.app;

    const uiRes = await prodApp.inject({ method: "GET", url: "/docs/" });
    const specRes = await prodApp.inject({ method: "GET", url: "/docs/json" });

    expect(uiRes.statusCode).toBe(404);
    expect(specRes.statusCode).toBe(404);

    await prodApp.close();
  });

  it("can expose Swagger UI in production when explicitly enabled", async () => {
    const ctx = await buildTestApp(undefined, { isProduction: true, enableDocs: true });
    const prodApp = ctx.app;

    const res = await prodApp.inject({ method: "GET", url: "/docs/" });
    expect(res.statusCode).toBe(200);

    await prodApp.close();
  });
});
