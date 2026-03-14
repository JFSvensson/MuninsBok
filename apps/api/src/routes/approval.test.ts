import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, type MockRepos } from "../test/helpers.js";

const JWT_SECRET = "test-secret-that-is-long-enough-for-jwt";

const orgId = "org-1";

const ADMIN_MEMBERSHIP = {
  id: "mem-admin",
  userId: "user-1",
  organizationId: orgId,
  role: "ADMIN" as const,
  createdAt: new Date(),
};

const MEMBER_MEMBERSHIP = {
  id: "mem-member",
  userId: "user-2",
  organizationId: orgId,
  role: "MEMBER" as const,
  createdAt: new Date(),
};

const OWNER_MEMBERSHIP = {
  id: "mem-owner",
  userId: "user-3",
  organizationId: orgId,
  role: "OWNER" as const,
  createdAt: new Date(),
};

const sampleRule = {
  id: "rule-1",
  organizationId: orgId,
  name: "Stora belopp",
  minAmount: 100_000,
  maxAmount: null,
  requiredRole: "ADMIN" as const,
  stepOrder: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sampleVoucher = {
  id: "v1",
  organizationId: orgId,
  fiscalYearId: "fy-1",
  number: 1,
  date: new Date("2024-03-01"),
  description: "Test",
  status: "DRAFT" as const,
  lines: [
    { id: "l1", voucherId: "v1", accountNumber: "1930", debit: 150_000, credit: 0 },
    { id: "l2", voucherId: "v1", accountNumber: "3000", debit: 0, credit: 150_000 },
  ],
  documentIds: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Approval routes", () => {
  let app: FastifyInstance;
  let repos: MockRepos;
  let adminToken: string;
  let memberToken: string;
  let ownerToken: string;

  beforeAll(async () => {
    const ctx = await buildTestApp(undefined, { jwtSecret: JWT_SECRET });
    app = ctx.app;
    repos = ctx.repos;
    await app.ready();

    adminToken = app.generateTokens("user-1", "admin@example.com").accessToken;
    memberToken = app.generateTokens("user-2", "member@example.com").accessToken;
    ownerToken = app.generateTokens("user-3", "owner@example.com").accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  function adminHeaders() {
    return { authorization: `Bearer ${adminToken}` };
  }

  function memberHeaders() {
    return { authorization: `Bearer ${memberToken}` };
  }

  function ownerHeaders() {
    return { authorization: `Bearer ${ownerToken}` };
  }

  // ── Approval Rules CRUD ────────────────────────────────

  describe("GET /:orgId/approval-rules", () => {
    it("lists approval rules", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.approvalRules.findByOrganization.mockResolvedValueOnce([sampleRule]);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/approval-rules`,
        headers: adminHeaders(),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveLength(1);
      expect(res.json().data[0].name).toBe("Stora belopp");
    });

    it("returns empty array when no rules exist", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.approvalRules.findByOrganization.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/approval-rules`,
        headers: adminHeaders(),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveLength(0);
    });
  });

  describe("POST /:orgId/approval-rules", () => {
    it("creates an approval rule as ADMIN", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.approvalRules.create.mockResolvedValueOnce({
        ok: true,
        value: sampleRule,
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/approval-rules`,
        headers: adminHeaders(),
        payload: {
          name: "Stora belopp",
          minAmount: 100_000,
          requiredRole: "ADMIN",
          stepOrder: 1,
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().data.name).toBe("Stora belopp");
    });

    it("rejects MEMBER role", async () => {
      repos.users.findMembership.mockResolvedValueOnce(MEMBER_MEMBERSHIP);

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/approval-rules`,
        headers: memberHeaders(),
        payload: {
          name: "Test",
          minAmount: 0,
          requiredRole: "MEMBER",
          stepOrder: 1,
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it("returns 400 for invalid create input", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.approvalRules.create.mockResolvedValueOnce({
        ok: false,
        error: { code: "INVALID_AMOUNT_RANGE", message: "minAmount > maxAmount" },
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/approval-rules`,
        headers: adminHeaders(),
        payload: {
          name: "Bad rule",
          minAmount: 200_000,
          maxAmount: 100_000,
          requiredRole: "ADMIN",
          stepOrder: 1,
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("PUT /:orgId/approval-rules/:ruleId", () => {
    it("updates an approval rule", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.approvalRules.update.mockResolvedValueOnce({
        ok: true,
        value: { ...sampleRule, name: "Uppdaterad" },
      });

      const res = await app.inject({
        method: "PUT",
        url: `/api/organizations/${orgId}/approval-rules/rule-1`,
        headers: adminHeaders(),
        payload: { name: "Uppdaterad" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.name).toBe("Uppdaterad");
    });

    it("returns 404 for non-existent rule", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.approvalRules.update.mockResolvedValueOnce({
        ok: false,
        error: { code: "NOT_FOUND", message: "Rule not found" },
      });

      const res = await app.inject({
        method: "PUT",
        url: `/api/organizations/${orgId}/approval-rules/nope`,
        headers: adminHeaders(),
        payload: { name: "Whatever" },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("DELETE /:orgId/approval-rules/:ruleId", () => {
    it("deletes an approval rule", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.approvalRules.delete.mockResolvedValueOnce(true);

      const res = await app.inject({
        method: "DELETE",
        url: `/api/organizations/${orgId}/approval-rules/rule-1`,
        headers: adminHeaders(),
      });

      expect(res.statusCode).toBe(204);
    });

    it("returns 404 for non-existent rule", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.approvalRules.delete.mockResolvedValueOnce(false);

      const res = await app.inject({
        method: "DELETE",
        url: `/api/organizations/${orgId}/approval-rules/nope`,
        headers: adminHeaders(),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ── Submit Voucher ─────────────────────────────────────

  describe("POST /:orgId/vouchers/:voucherId/submit", () => {
    it("auto-approves when no rules match", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.vouchers.findById.mockResolvedValueOnce(sampleVoucher);
      repos.approvalRules.findByOrganization.mockResolvedValueOnce([]);
      repos.prisma.voucher.update.mockResolvedValueOnce({});
      const approved = { ...sampleVoucher, status: "APPROVED" };
      repos.vouchers.findById.mockResolvedValueOnce(approved);

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/vouchers/v1/submit`,
        headers: adminHeaders(),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe("APPROVED");
      expect(repos.prisma.voucher.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "v1" },
          data: expect.objectContaining({ status: "APPROVED" }),
        }),
      );
    });

    it("creates steps and sets PENDING when rules match", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.vouchers.findById.mockResolvedValueOnce(sampleVoucher);
      repos.approvalRules.findByOrganization.mockResolvedValueOnce([sampleRule]);
      repos.approvalSteps.createMany.mockResolvedValueOnce([
        {
          id: "step-1",
          voucherId: "v1",
          stepOrder: 1,
          requiredRole: "ADMIN",
          status: "PENDING",
          approverUserId: null,
          comment: null,
          decidedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      repos.prisma.voucher.update.mockResolvedValueOnce({});
      const pending = { ...sampleVoucher, status: "PENDING" };
      repos.vouchers.findById.mockResolvedValueOnce(pending);

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/vouchers/v1/submit`,
        headers: adminHeaders(),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe("PENDING");
      expect(repos.approvalSteps.createMany).toHaveBeenCalled();
    });

    it("returns 404 for unknown voucher", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.vouchers.findById.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/vouchers/nope/submit`,
        headers: adminHeaders(),
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 when voucher is not DRAFT", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.vouchers.findById.mockResolvedValueOnce({
        ...sampleVoucher,
        status: "PENDING",
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/vouchers/v1/submit`,
        headers: adminHeaders(),
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── Decide Step ────────────────────────────────────────

  describe("POST /:orgId/vouchers/:voucherId/approval-steps/:stepId/decide", () => {
    const pendingStep = {
      id: "step-1",
      voucherId: "v1",
      stepOrder: 1,
      requiredRole: "ADMIN" as const,
      status: "PENDING" as const,
      approverUserId: null,
      comment: null,
      decidedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("approves a step successfully", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.vouchers.findById.mockResolvedValueOnce({
        ...sampleVoucher,
        status: "PENDING",
      });
      repos.approvalSteps.findByVoucher.mockResolvedValueOnce([pendingStep]);
      repos.approvalSteps.decide.mockResolvedValueOnce({
        ok: true,
        value: { ...pendingStep, status: "APPROVED", approverUserId: "user-1" },
      });
      // After decision, fetch updated steps for status computation
      repos.approvalSteps.findByVoucher.mockResolvedValueOnce([
        { ...pendingStep, status: "APPROVED" },
      ]);
      repos.prisma.voucher.update.mockResolvedValueOnce({});
      repos.vouchers.findById.mockResolvedValueOnce({
        ...sampleVoucher,
        status: "APPROVED",
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/vouchers/v1/approval-steps/step-1/decide`,
        headers: adminHeaders(),
        payload: { decision: "APPROVED" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe("APPROVED");
    });

    it("rejects a step and sets voucher to REJECTED", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.vouchers.findById.mockResolvedValueOnce({
        ...sampleVoucher,
        status: "PENDING",
      });
      repos.approvalSteps.findByVoucher.mockResolvedValueOnce([pendingStep]);
      repos.approvalSteps.decide.mockResolvedValueOnce({
        ok: true,
        value: { ...pendingStep, status: "REJECTED", approverUserId: "user-1" },
      });
      repos.approvalSteps.findByVoucher.mockResolvedValueOnce([
        { ...pendingStep, status: "REJECTED" },
      ]);
      repos.prisma.voucher.update.mockResolvedValueOnce({});
      repos.vouchers.findById.mockResolvedValueOnce({
        ...sampleVoucher,
        status: "REJECTED",
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/vouchers/v1/approval-steps/step-1/decide`,
        headers: adminHeaders(),
        payload: { decision: "REJECTED", comment: "Fel belopp" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe("REJECTED");
    });

    it("returns 404 for unknown voucher", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.vouchers.findById.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/vouchers/v1/approval-steps/step-1/decide`,
        headers: adminHeaders(),
        payload: { decision: "APPROVED" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 when voucher is not PENDING", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.vouchers.findById.mockResolvedValueOnce(sampleVoucher); // status DRAFT

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/vouchers/v1/approval-steps/step-1/decide`,
        headers: adminHeaders(),
        payload: { decision: "APPROVED" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 404 for unknown step", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.vouchers.findById.mockResolvedValueOnce({
        ...sampleVoucher,
        status: "PENDING",
      });
      repos.approvalSteps.findByVoucher.mockResolvedValueOnce([pendingStep]);

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/vouchers/v1/approval-steps/unknown/decide`,
        headers: adminHeaders(),
        payload: { decision: "APPROVED" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 when step is not next in order", async () => {
      const step2 = { ...pendingStep, id: "step-2", stepOrder: 2 };
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.vouchers.findById.mockResolvedValueOnce({
        ...sampleVoucher,
        status: "PENDING",
      });
      repos.approvalSteps.findByVoucher.mockResolvedValueOnce([pendingStep, step2]);

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/vouchers/v1/approval-steps/step-2/decide`,
        headers: adminHeaders(),
        payload: { decision: "APPROVED" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 403 when role is insufficient", async () => {
      // Step requires ADMIN, user is MEMBER
      repos.users.findMembership.mockResolvedValueOnce(MEMBER_MEMBERSHIP);
      repos.vouchers.findById.mockResolvedValueOnce({
        ...sampleVoucher,
        status: "PENDING",
      });
      repos.approvalSteps.findByVoucher.mockResolvedValueOnce([pendingStep]);

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/vouchers/v1/approval-steps/step-1/decide`,
        headers: memberHeaders(),
        payload: { decision: "APPROVED" },
      });

      expect(res.statusCode).toBe(403);
    });

    it("allows OWNER to approve ADMIN-required step", async () => {
      repos.users.findMembership.mockResolvedValueOnce(OWNER_MEMBERSHIP);
      repos.vouchers.findById.mockResolvedValueOnce({
        ...sampleVoucher,
        status: "PENDING",
      });
      repos.approvalSteps.findByVoucher.mockResolvedValueOnce([pendingStep]);
      repos.approvalSteps.decide.mockResolvedValueOnce({
        ok: true,
        value: { ...pendingStep, status: "APPROVED", approverUserId: "user-3" },
      });
      repos.approvalSteps.findByVoucher.mockResolvedValueOnce([
        { ...pendingStep, status: "APPROVED" },
      ]);
      repos.prisma.voucher.update.mockResolvedValueOnce({});
      repos.vouchers.findById.mockResolvedValueOnce({
        ...sampleVoucher,
        status: "APPROVED",
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/vouchers/v1/approval-steps/step-1/decide`,
        headers: ownerHeaders(),
        payload: { decision: "APPROVED" },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // ── List Pending Steps ─────────────────────────────────

  describe("GET /:orgId/approval-steps/pending", () => {
    it("returns pending steps for the organization", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.approvalSteps.findPendingByOrganization.mockResolvedValueOnce([
        {
          id: "step-1",
          voucherId: "v1",
          stepOrder: 1,
          requiredRole: "ADMIN",
          status: "PENDING",
          approverUserId: null,
          comment: null,
          decidedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/approval-steps/pending`,
        headers: adminHeaders(),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveLength(1);
    });
  });

  // ── List Voucher Steps ─────────────────────────────────

  describe("GET /:orgId/vouchers/:voucherId/approval-steps", () => {
    it("returns steps for a voucher", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.vouchers.findById.mockResolvedValueOnce(sampleVoucher);
      repos.approvalSteps.findByVoucher.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/vouchers/v1/approval-steps`,
        headers: adminHeaders(),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveLength(0);
    });

    it("returns 404 for unknown voucher", async () => {
      repos.users.findMembership.mockResolvedValueOnce(ADMIN_MEMBERSHIP);
      repos.vouchers.findById.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/vouchers/nope/approval-steps`,
        headers: adminHeaders(),
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
