import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, VoucherRepository } from "@muninsbok/db";

const createVoucherLineSchema = z.object({
  accountNumber: z.string().regex(/^[1-8]\d{3}$/),
  debit: z.number().int().min(0),
  credit: z.number().int().min(0),
  description: z.string().optional(),
});

const createVoucherSchema = z.object({
  fiscalYearId: z.string(),
  date: z.string().transform((s) => new Date(s)),
  description: z.string().min(1).max(500),
  lines: z.array(createVoucherLineSchema).min(1),
  documentIds: z.array(z.string()).optional(),
});

export async function voucherRoutes(fastify: FastifyInstance) {
  const voucherRepo = new VoucherRepository(prisma);

  // List vouchers for a fiscal year
  fastify.get<{
    Params: { orgId: string };
    Querystring: { fiscalYearId?: string; startDate?: string; endDate?: string };
  }>("/:orgId/vouchers", async (request, reply) => {
    const { orgId } = request.params;
    const { fiscalYearId, startDate, endDate } = request.query;

    if (fiscalYearId) {
      const vouchers = await voucherRepo.findByFiscalYear(fiscalYearId, orgId);
      return { data: vouchers };
    }

    if (startDate && endDate) {
      const vouchers = await voucherRepo.findByDateRange(
        orgId,
        new Date(startDate),
        new Date(endDate)
      );
      return { data: vouchers };
    }

    return reply.status(400).send({
      error: "Either fiscalYearId or startDate+endDate must be provided",
    });
  });

  // Get single voucher
  fastify.get<{ Params: { orgId: string; voucherId: string } }>(
    "/:orgId/vouchers/:voucherId",
    async (request, reply) => {
      const voucher = await voucherRepo.findById(
        request.params.voucherId,
        request.params.orgId
      );
      if (!voucher) {
        return reply.status(404).send({ error: "Voucher not found" });
      }
      return { data: voucher };
    }
  );

  // Create voucher
  fastify.post<{ Params: { orgId: string } }>(
    "/:orgId/vouchers",
    async (request, reply) => {
      const parsed = createVoucherSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues });
      }

      const result = await voucherRepo.create({
        ...parsed.data,
        organizationId: request.params.orgId,
      });

      if (!result.ok) {
        return reply.status(400).send({ error: result.error });
      }

      return reply.status(201).send({ data: result.value });
    }
  );

  // Delete voucher
  fastify.delete<{ Params: { orgId: string; voucherId: string } }>(
    "/:orgId/vouchers/:voucherId",
    async (request, reply) => {
      const deleted = await voucherRepo.delete(
        request.params.voucherId,
        request.params.orgId
      );
      if (!deleted) {
        return reply.status(404).send({ error: "Voucher not found" });
      }
      return reply.status(204).send();
    }
  );
}
