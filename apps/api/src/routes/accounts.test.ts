import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, type MockRepos } from "../test/helpers.js";

describe("Account routes", () => {
  let app: FastifyInstance;
  let repos: MockRepos;

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
    repos = ctx.repos;
  });

  const orgId = "org-1";
  const baseUrl = `/api/organizations/${orgId}/accounts`;

  const sampleAccount = {
    id: "acc-1",
    organizationId: orgId,
    number: "1930",
    name: "Bankkonto",
    type: "ASSET" as const,
    isVatAccount: false,
    isActive: true,
  };

  describe("GET /:orgId/accounts", () => {
    it("returns all accounts", async () => {
      repos.accounts.findByOrganization.mockResolvedValue([sampleAccount]);

      const res = await app.inject({ method: "GET", url: baseUrl });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data).toHaveLength(1);
      expect(repos.accounts.findByOrganization).toHaveBeenCalledWith(orgId);
    });

    it("returns only active accounts when ?active=true", async () => {
      repos.accounts.findActive.mockResolvedValue([sampleAccount]);

      const res = await app.inject({ method: "GET", url: `${baseUrl}?active=true` });

      expect(res.statusCode).toBe(200);
      expect(repos.accounts.findActive).toHaveBeenCalledWith(orgId);
    });
  });

  describe("GET /:orgId/accounts/:accountNumber", () => {
    it("returns account by number", async () => {
      repos.accounts.findByNumber.mockResolvedValue(sampleAccount);

      const res = await app.inject({ method: "GET", url: `${baseUrl}/1930` });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.number).toBe("1930");
    });

    it("returns 404 for unknown account", async () => {
      repos.accounts.findByNumber.mockResolvedValue(null);

      const res = await app.inject({ method: "GET", url: `${baseUrl}/9999` });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /:orgId/accounts", () => {
    it("creates account with valid data", async () => {
      repos.accounts.create.mockResolvedValue({ ok: true, value: sampleAccount });

      const res = await app.inject({
        method: "POST",
        url: baseUrl,
        payload: { number: "1930", name: "Bankkonto", type: "ASSET" },
      });

      expect(res.statusCode).toBe(201);
      expect(repos.accounts.create).toHaveBeenCalledWith(orgId, expect.objectContaining({ number: "1930" }));
    });

    it("returns 400 for invalid account number", async () => {
      const res = await app.inject({
        method: "POST",
        url: baseUrl,
        payload: { number: "99", name: "Invalid", type: "ASSET" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 for invalid type", async () => {
      const res = await app.inject({
        method: "POST",
        url: baseUrl,
        payload: { number: "1930", name: "Test", type: "INVALID" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when repo create fails", async () => {
      repos.accounts.create.mockResolvedValue({
        ok: false,
        error: { code: "DUPLICATE_NUMBER", message: "Konto 1930 finns redan" },
      });

      const res = await app.inject({
        method: "POST",
        url: baseUrl,
        payload: { number: "1930", name: "Bankkonto", type: "ASSET" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("DELETE /:orgId/accounts/:accountNumber", () => {
    it("deactivates account", async () => {
      repos.accounts.deactivate.mockResolvedValue(true);

      const res = await app.inject({ method: "DELETE", url: `${baseUrl}/1930` });

      expect(res.statusCode).toBe(204);
    });

    it("returns 404 when deactivation fails", async () => {
      repos.accounts.deactivate.mockResolvedValue(false);

      const res = await app.inject({ method: "DELETE", url: `${baseUrl}/9999` });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("PUT /:orgId/accounts/:accountNumber", () => {
    it("updates account name", async () => {
      repos.accounts.update.mockResolvedValue({ ok: true, value: { ...sampleAccount, name: "Nytt namn" } });

      const res = await app.inject({
        method: "PUT",
        url: `${baseUrl}/1930`,
        payload: { name: "Nytt namn" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.name).toBe("Nytt namn");
      expect(repos.accounts.update).toHaveBeenCalledWith(orgId, "1930", { name: "Nytt namn" });
    });

    it("updates account type and isVatAccount", async () => {
      const updated = { ...sampleAccount, type: "EXPENSE" as const, isVatAccount: true };
      repos.accounts.update.mockResolvedValue({ ok: true, value: updated });

      const res = await app.inject({
        method: "PUT",
        url: `${baseUrl}/1930`,
        payload: { type: "EXPENSE", isVatAccount: true },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.type).toBe("EXPENSE");
    });

    it("returns 400 for invalid type", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `${baseUrl}/1930`,
        payload: { type: "INVALID" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 404 when account not found", async () => {
      repos.accounts.update.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Konto 9999 hittades inte" },
      });

      const res = await app.inject({
        method: "PUT",
        url: `${baseUrl}/9999`,
        payload: { name: "Test" },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
