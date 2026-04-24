import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../test/helpers.js";

describe("Prometheus /metrics endpoint", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
  });

  it("returns 200 with Prometheus content-type", async () => {
    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
  });

  it("includes default Node.js metrics", async () => {
    const res = await app.inject({ method: "GET", url: "/metrics" });
    const body = res.body;
    expect(body).toContain("process_cpu_seconds_total");
    expect(body).toContain("nodejs_heap_size_used_bytes");
  });

  it("includes http_requests_total metric", async () => {
    // Make a request that gets tracked
    await app.inject({ method: "GET", url: "/health" });
    // But /health is excluded, so make a tracked request
    await app.inject({ method: "GET", url: "/api/organizations" });

    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.body).toContain("http_requests_total");
  });

  it("includes http_request_duration_seconds metric", async () => {
    await app.inject({ method: "GET", url: "/api/organizations" });

    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.body).toContain("http_request_duration_seconds");
  });

  it("increments counter for tracked routes", async () => {
    await app.inject({ method: "GET", url: "/api/organizations" });
    await app.inject({ method: "GET", url: "/api/organizations" });

    const res = await app.inject({ method: "GET", url: "/metrics" });
    // Counter should show at least 2 requests
    const matches = res.body.match(/http_requests_total\{[^}]*method="GET"[^}]*\}\s+(\d+)/);
    expect(matches).not.toBeNull();
    expect(Number(matches![1])).toBeGreaterThanOrEqual(2);
  });

  it("excludes /metrics from http_requests_total", async () => {
    // Only call /metrics (no other routes)
    await app.inject({ method: "GET", url: "/metrics" });
    await app.inject({ method: "GET", url: "/metrics" });

    const res = await app.inject({ method: "GET", url: "/metrics" });
    // There should be no http_requests_total line with route="/metrics"
    expect(res.body).not.toMatch(/http_requests_total\{[^}]*route="\/metrics"/);
  });

  it("excludes /health from http_requests_total", async () => {
    await app.inject({ method: "GET", url: "/health" });

    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.body).not.toMatch(/http_requests_total\{[^}]*route="\/health"/);
  });

  it("is disabled by default in production", async () => {
    const ctx = await buildTestApp(undefined, { isProduction: true });
    const prodApp = ctx.app;

    const res = await prodApp.inject({ method: "GET", url: "/metrics" });
    expect(res.statusCode).toBe(404);

    await prodApp.close();
  });

  it("requires bearer metrics token in production when configured", async () => {
    const ctx = await buildTestApp(undefined, {
      isProduction: true,
      metricsToken: "metrics-secret",
    });
    const prodApp = ctx.app;

    const unauth = await prodApp.inject({ method: "GET", url: "/metrics" });
    expect(unauth.statusCode).toBe(401);

    const wrong = await prodApp.inject({
      method: "GET",
      url: "/metrics",
      headers: { authorization: "Bearer wrong" },
    });
    expect(wrong.statusCode).toBe(401);

    const ok = await prodApp.inject({
      method: "GET",
      url: "/metrics",
      headers: { authorization: "Bearer metrics-secret" },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers["content-type"]).toContain("text/plain");

    await prodApp.close();
  });
});
