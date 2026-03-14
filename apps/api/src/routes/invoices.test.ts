import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type MockRepos } from "../test/helpers.js";
import type { FastifyInstance } from "fastify";

describe("invoiceRoutes", () => {
  let app: FastifyInstance;
  let repos: MockRepos;

  beforeAll(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
    repos = ctx.repos;
  });
  afterAll(async () => app.close());

  const ORG = "/api/organizations/org-1";

  // ── Customer CRUD ──────────────────────────────────────────

  describe("GET /:orgId/customers", () => {
    it("returns customer list", async () => {
      const customers = [
        {
          id: "c1",
          organizationId: "org-1",
          customerNumber: 1,
          name: "Acme AB",
          paymentTermDays: 30,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      repos.customers.findByOrganization.mockResolvedValue(customers);

      const res = await app.inject({ method: "GET", url: `${ORG}/customers` });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveLength(1);
      expect(res.json().data[0].name).toBe("Acme AB");
    });
  });

  describe("GET /:orgId/customers/:customerId", () => {
    it("returns 404 when not found", async () => {
      repos.customers.findById.mockResolvedValue(null);
      const res = await app.inject({ method: "GET", url: `${ORG}/customers/c1` });
      expect(res.statusCode).toBe(404);
    });

    it("returns customer when found", async () => {
      const customer = {
        id: "c1",
        organizationId: "org-1",
        customerNumber: 1,
        name: "Acme AB",
        paymentTermDays: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      repos.customers.findById.mockResolvedValue(customer);
      const res = await app.inject({ method: "GET", url: `${ORG}/customers/c1` });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.name).toBe("Acme AB");
    });
  });

  describe("POST /:orgId/customers", () => {
    it("creates customer and returns 201", async () => {
      const customer = {
        id: "c1",
        organizationId: "org-1",
        customerNumber: 1,
        name: "Acme AB",
        paymentTermDays: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      repos.customers.create.mockResolvedValue({ ok: true, value: customer });

      const res = await app.inject({
        method: "POST",
        url: `${ORG}/customers`,
        payload: { name: "Acme AB" },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().data.name).toBe("Acme AB");
    });

    it("returns 400 on invalid input", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${ORG}/customers`,
        payload: { name: "" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("accepts optional fields", async () => {
      const customer = {
        id: "c2",
        organizationId: "org-1",
        customerNumber: 2,
        name: "Test AB",
        email: "test@test.se",
        phone: "0701234567",
        paymentTermDays: 45,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      repos.customers.create.mockResolvedValue({ ok: true, value: customer });

      const res = await app.inject({
        method: "POST",
        url: `${ORG}/customers`,
        payload: {
          name: "Test AB",
          email: "test@test.se",
          phone: "0701234567",
          paymentTermDays: 45,
        },
      });
      expect(res.statusCode).toBe(201);
    });
  });

  describe("PUT /:orgId/customers/:customerId", () => {
    it("updates customer", async () => {
      const customer = {
        id: "c1",
        organizationId: "org-1",
        customerNumber: 1,
        name: "New Name",
        paymentTermDays: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      repos.customers.update.mockResolvedValue({ ok: true, value: customer });

      const res = await app.inject({
        method: "PUT",
        url: `${ORG}/customers/c1`,
        payload: { name: "New Name" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.name).toBe("New Name");
    });

    it("returns 404 when not found", async () => {
      repos.customers.update.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Hittades inte" },
      });
      const res = await app.inject({
        method: "PUT",
        url: `${ORG}/customers/c1`,
        payload: { name: "New Name" },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("DELETE /:orgId/customers/:customerId", () => {
    it("returns 204 on successful delete", async () => {
      repos.customers.delete.mockResolvedValue(true);
      const res = await app.inject({ method: "DELETE", url: `${ORG}/customers/c1` });
      expect(res.statusCode).toBe(204);
    });

    it("returns 404 when not found", async () => {
      repos.customers.delete.mockResolvedValue(false);
      const res = await app.inject({ method: "DELETE", url: `${ORG}/customers/c1` });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── Invoice CRUD ──────────────────────────────────────────

  const sampleInvoice = {
    id: "inv-1",
    organizationId: "org-1",
    customerId: "c1",
    invoiceNumber: 1,
    status: "DRAFT" as const,
    issueDate: new Date("2025-01-15"),
    dueDate: new Date("2025-02-14"),
    subtotal: 10000,
    vatAmount: 2500,
    totalAmount: 12500,
    lines: [
      {
        id: "line-1",
        invoiceId: "inv-1",
        description: "Test",
        quantity: 100,
        unitPrice: 10000,
        vatRate: 2500,
        amount: 10000,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("GET /:orgId/invoices", () => {
    it("returns all invoices", async () => {
      repos.invoices.findByOrganization.mockResolvedValue([sampleInvoice]);

      const res = await app.inject({ method: "GET", url: `${ORG}/invoices` });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveLength(1);
    });

    it("filters by status when provided", async () => {
      repos.invoices.findByStatus.mockResolvedValue([sampleInvoice]);

      const res = await app.inject({ method: "GET", url: `${ORG}/invoices?status=DRAFT` });
      expect(res.statusCode).toBe(200);
      expect(repos.invoices.findByStatus).toHaveBeenCalledWith("org-1", "DRAFT");
    });
  });

  describe("GET /:orgId/invoices/:invoiceId", () => {
    it("returns 404 when not found", async () => {
      repos.invoices.findById.mockResolvedValue(null);
      const res = await app.inject({ method: "GET", url: `${ORG}/invoices/inv-1` });
      expect(res.statusCode).toBe(404);
    });

    it("returns invoice when found", async () => {
      repos.invoices.findById.mockResolvedValue(sampleInvoice);
      const res = await app.inject({ method: "GET", url: `${ORG}/invoices/inv-1` });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.invoiceNumber).toBe(1);
    });
  });

  describe("GET /:orgId/customers/:customerId/invoices", () => {
    it("returns invoices for customer", async () => {
      repos.invoices.findByCustomer.mockResolvedValue([sampleInvoice]);
      const res = await app.inject({ method: "GET", url: `${ORG}/customers/c1/invoices` });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveLength(1);
    });
  });

  describe("POST /:orgId/invoices", () => {
    it("creates invoice and returns 201", async () => {
      repos.invoices.create.mockResolvedValue({ ok: true, value: sampleInvoice });

      const res = await app.inject({
        method: "POST",
        url: `${ORG}/invoices`,
        payload: {
          customerId: "c1",
          issueDate: "2025-01-15",
          dueDate: "2025-02-14",
          lines: [{ description: "Test", quantity: 100, unitPrice: 10000, vatRate: 2500 }],
        },
      });
      expect(res.statusCode).toBe(201);
    });

    it("returns 400 with empty lines", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${ORG}/invoices`,
        payload: {
          customerId: "c1",
          issueDate: "2025-01-15",
          dueDate: "2025-02-14",
          lines: [],
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 without required fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${ORG}/invoices`,
        payload: { customerId: "c1" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when repo returns error", async () => {
      repos.invoices.create.mockResolvedValue({
        ok: false,
        error: { code: "CUSTOMER_NOT_FOUND", message: "Kunden hittades inte" },
      });

      const res = await app.inject({
        method: "POST",
        url: `${ORG}/invoices`,
        payload: {
          customerId: "c1",
          issueDate: "2025-01-15",
          dueDate: "2025-02-14",
          lines: [{ description: "Test", quantity: 100, unitPrice: 10000, vatRate: 2500 }],
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("PUT /:orgId/invoices/:invoiceId", () => {
    it("updates invoice", async () => {
      repos.invoices.update.mockResolvedValue({
        ok: true,
        value: { ...sampleInvoice, notes: "Updated" },
      });

      const res = await app.inject({
        method: "PUT",
        url: `${ORG}/invoices/inv-1`,
        payload: { notes: "Updated" },
      });
      expect(res.statusCode).toBe(200);
    });

    it("returns 404 when not found", async () => {
      repos.invoices.update.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Ej hittat" },
      });
      const res = await app.inject({
        method: "PUT",
        url: `${ORG}/invoices/inv-1`,
        payload: { notes: "New" },
      });
      expect(res.statusCode).toBe(404);
    });

    it("returns 400 when not draft", async () => {
      repos.invoices.update.mockResolvedValue({
        ok: false,
        error: { code: "NOT_DRAFT", message: "Bara utkast" },
      });
      const res = await app.inject({
        method: "PUT",
        url: `${ORG}/invoices/inv-1`,
        payload: { notes: "New" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /:orgId/invoices/:invoiceId/status", () => {
    it("marks invoice as SENT", async () => {
      repos.invoices.findById.mockResolvedValue(sampleInvoice);
      repos.invoices.updateStatus.mockResolvedValue({
        ok: true,
        value: { ...sampleInvoice, status: "SENT" },
      });

      const res = await app.inject({
        method: "POST",
        url: `${ORG}/invoices/inv-1/status`,
        payload: { status: "SENT" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe("SENT");
    });

    it("marks invoice as PAID with date", async () => {
      const sentInvoice = { ...sampleInvoice, status: "SENT" as const };
      repos.invoices.findById.mockResolvedValue(sentInvoice);
      repos.invoices.updateStatus.mockResolvedValue({
        ok: true,
        value: { ...sentInvoice, status: "PAID" },
      });

      const res = await app.inject({
        method: "POST",
        url: `${ORG}/invoices/inv-1/status`,
        payload: { status: "PAID", paidDate: "2025-02-10" },
      });
      expect(res.statusCode).toBe(200);
    });

    it("rejects invalid transition DRAFT → PAID", async () => {
      repos.invoices.findById.mockResolvedValue(sampleInvoice);

      const res = await app.inject({
        method: "POST",
        url: `${ORG}/invoices/inv-1/status`,
        payload: { status: "PAID" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("INVALID_STATUS");
    });

    it("returns 404 when invoice not found", async () => {
      repos.invoices.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: `${ORG}/invoices/inv-1/status`,
        payload: { status: "SENT" },
      });
      expect(res.statusCode).toBe(404);
    });

    it("rejects invalid status value", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${ORG}/invoices/inv-1/status`,
        payload: { status: "INVALID" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("DELETE /:orgId/invoices/:invoiceId", () => {
    it("returns 204 on successful delete", async () => {
      repos.invoices.delete.mockResolvedValue(true);
      const res = await app.inject({ method: "DELETE", url: `${ORG}/invoices/inv-1` });
      expect(res.statusCode).toBe(204);
    });

    it("returns 404 when not found or not draft", async () => {
      repos.invoices.delete.mockResolvedValue(false);
      const res = await app.inject({ method: "DELETE", url: `${ORG}/invoices/inv-1` });
      expect(res.statusCode).toBe(404);
    });
  });
});
