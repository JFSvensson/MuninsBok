import type { FastifyInstance } from "fastify";
import { z } from "zod";

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
  const voucherRepo = fastify.repos.vouchers;

  // List vouchers for a fiscal year (paginated)
  fastify.get<{
    Params: { orgId: string };
    Querystring: {
      fiscalYearId?: string;
      startDate?: string;
      endDate?: string;
      page?: string;
      limit?: string;
      search?: string;
    };
  }>("/:orgId/vouchers", async (request, reply) => {
    const { orgId } = request.params;
    const { fiscalYearId, startDate, endDate, page, limit, search } = request.query;

    if (fiscalYearId) {
      const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
      const limitNum = Math.min(200, Math.max(1, parseInt(limit ?? "50", 10) || 50));

      const result = await voucherRepo.findByFiscalYearPaginated(
        fiscalYearId,
        orgId,
        { page: pageNum, limit: limitNum, ...(search != null && { search }) }
      );

      return {
        data: result.vouchers,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
        },
      };
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
        return reply.status(404).send({ error: "Verifikatet hittades inte" });
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

      const { lines, documentIds, ...rest } = parsed.data;
      const result = await voucherRepo.create({
        ...rest,
        organizationId: request.params.orgId,
        lines: lines.map((l) => ({
          accountNumber: l.accountNumber,
          debit: l.debit,
          credit: l.credit,
          ...(l.description != null && { description: l.description }),
        })),
        ...(documentIds != null && { documentIds }),
      });

      if (!result.ok) {
        return reply.status(400).send({ error: result.error });
      }

      return reply.status(201).send({ data: result.value });
    }
  );

  // Create correction voucher (rättelseverifikat) — BFL 5:5
  fastify.post<{ Params: { orgId: string; voucherId: string } }>(
    "/:orgId/vouchers/:voucherId/correct",
    async (request, reply) => {
      const result = await voucherRepo.createCorrection(
        request.params.voucherId,
        request.params.orgId
      );

      if (!result.ok) {
        const status = result.error.code === "NOT_FOUND" ? 404 : 400;
        return reply.status(status).send({ error: result.error });
      }

      return reply.status(201).send({ data: result.value });
    }
  );

  // Check voucher number gaps (BFL 5:6 – löpnumrering)
  fastify.get<{
    Params: { orgId: string };
    Querystring: { fiscalYearId: string };
  }>("/:orgId/vouchers/gaps", async (request, reply) => {
    const { orgId } = request.params;
    const { fiscalYearId } = request.query;

    if (!fiscalYearId) {
      return reply.status(400).send({ error: "fiscalYearId krävs" });
    }

    const gaps = await voucherRepo.findNumberGaps(fiscalYearId, orgId);
    return { data: { gaps, count: gaps.length } };
  });
}
