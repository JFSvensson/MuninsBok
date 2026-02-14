import type { FastifyInstance } from "fastify";
import { z } from "zod";

const createFiscalYearSchema = z.object({
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z.string().transform((s) => new Date(s)),
});

export async function fiscalYearRoutes(fastify: FastifyInstance) {
  const fyRepo = fastify.repos.fiscalYears;

  // List fiscal years for organization
  fastify.get<{ Params: { orgId: string } }>(
    "/:orgId/fiscal-years",
    async (request) => {
      const fiscalYears = await fyRepo.findByOrganization(
        request.params.orgId
      );
      return { data: fiscalYears };
    }
  );

  // Get single fiscal year
  fastify.get<{ Params: { orgId: string; fyId: string } }>(
    "/:orgId/fiscal-years/:fyId",
    async (request, reply) => {
      const fy = await fyRepo.findById(
        request.params.fyId,
        request.params.orgId
      );
      if (!fy) {
        return reply.status(404).send({ error: "Fiscal year not found" });
      }
      return { data: fy };
    }
  );

  // Create fiscal year
  fastify.post<{ Params: { orgId: string } }>(
    "/:orgId/fiscal-years",
    async (request, reply) => {
      const parsed = createFiscalYearSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues });
      }

      const result = await fyRepo.create({
        organizationId: request.params.orgId,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
      });

      if (!result.ok) {
        return reply.status(400).send({ error: result.error });
      }

      return reply.status(201).send({ data: result.value });
    }
  );

  // Close fiscal year (creates closing voucher + marks as closed)
  fastify.patch<{ Params: { orgId: string; fyId: string } }>(
    "/:orgId/fiscal-years/:fyId/close",
    async (request, reply) => {
      const result = await fyRepo.close(
        request.params.fyId,
        request.params.orgId
      );

      if (!result.ok) {
        if (result.error.code === "NOT_FOUND") {
          return reply.status(404).send({ error: result.error });
        }
        return reply.status(400).send({ error: result.error });
      }

      return { data: result.value };
    }
  );

  // Create opening balances from previous fiscal year
  fastify.post<{
    Params: { orgId: string; fyId: string };
    Body: { previousFiscalYearId: string };
  }>(
    "/:orgId/fiscal-years/:fyId/opening-balances",
    async (request, reply) => {
      const body = z
        .object({ previousFiscalYearId: z.string() })
        .safeParse(request.body);

      if (!body.success) {
        return reply.status(400).send({ error: body.error.issues });
      }

      const result = await fyRepo.createOpeningBalances(
        request.params.fyId,
        body.data.previousFiscalYearId,
        request.params.orgId
      );

      if (!result.ok) {
        if (result.error.code === "NOT_FOUND") {
          return reply.status(404).send({ error: result.error });
        }
        return reply.status(400).send({ error: result.error });
      }

      return reply.status(201).send({ data: result.value });
    }
  );
}
