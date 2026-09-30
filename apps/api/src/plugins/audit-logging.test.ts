import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, type MockRepos } from "../test/helpers.js";

describe("Audit logging plugin", () => {
  let app: FastifyInstance;
  let repos: MockRepos;

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
    repos = ctx.repos;
  });

  it("logs write operations with audit flag", async () => {
    repos.organizations.createWithInitialData.mockResolvedValue({
      ok: true,
      value: {
        id: "org-new",
        orgNumber: "5591234567",
        name: "Audit AB",
        fiscalYearStartMonth: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Spy on the Pino logger info method
    const logSpy = vi.fn();
    app.addHook("onRequest", async (request) => {
      request.log.info = logSpy;
    });

    await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ name: "Audit AB", orgNumber: "5591234567" }),
    });

    // Find the audit log call
    const auditCall = logSpy.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "object" && call[0] !== null && "audit" in call[0],
    );
    expect(auditCall).toBeDefined();

    const auditData = auditCall![0] as Record<string, unknown>;
    expect(auditData["audit"]).toBe(true);
    expect(auditData["userId"]).toBeNull(); // no JWT in default test app
    expect(auditData["method"]).toBe("POST");
    expect(auditData["url"]).toBe("/api/organizations");
    expect(auditData["statusCode"]).toBeDefined();
    expect(auditData["timestamp"]).toBeDefined();
  });

  it("does not log GET requests as audit events", async () => {
    const logSpy = vi.fn();
    app.addHook("onRequest", async (request) => {
      request.log.info = logSpy;
    });

    await app.inject({ method: "GET", url: "/health" });

    const auditCall = logSpy.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "object" && call[0] !== null && "audit" in call[0],
    );
    expect(auditCall).toBeUndefined();
  });

  it("includes userId when JWT is enabled", async () => {
    const secret = "test-secret-that-is-long-enough-for-jwt";
    const authCtx = await buildTestApp(undefined, { jwtSecret: secret });
    const authApp = authCtx.app;
    const authRepos = authCtx.repos;

    authRepos.organizations.createWithInitialData.mockResolvedValue({
      ok: true,
      value: {
        id: "org-new",
        orgNumber: "5591234567",
        name: "Audit AB",
        fiscalYearStartMonth: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Hook must be added BEFORE ready()
    const logSpy = vi.fn();
    authApp.addHook("onRequest", async (request) => {
      const original = request.log.info.bind(request.log) as (...args: unknown[]) => void;
      request.log.info = (...args: unknown[]) => {
        logSpy(...args);
        return original(...args);
      };
    });

    await authApp.ready();

    const { accessToken } = authApp.generateTokens("user-42", "audit@example.com");
    await authApp.inject({
      method: "POST",
      url: "/api/organizations",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      payload: JSON.stringify({ name: "Audit AB", orgNumber: "5591234567" }),
    });

    const auditCall = logSpy.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "object" && call[0] !== null && "audit" in call[0],
    );
    expect(auditCall).toBeDefined();
    const auditData = auditCall![0] as Record<string, unknown>;
    expect(auditData["userId"]).toBe("user-42");

    await authApp.close();
  });
});
