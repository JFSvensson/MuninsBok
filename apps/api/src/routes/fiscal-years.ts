import type { FastifyInstance } from "fastify";
import { createFiscalYearSchema, openingBalancesSchema } from "../schemas/index.js";
import { parseBody } from "../utils/parse-body.js";

export async function fiscalYearRoutes(fastify: FastifyInstance) {
  const fyRepo = fastify.repos.fiscalYears;

  // List fiscal years for organization
  fastify.get<{ Params: { orgId: string } }>("/:orgId/fiscal-years", async (request) => {
    const fiscalYears = await fyRepo.findByOrganization(request.params.orgId);
    return { data: fiscalYears };
  });

  // Get single fiscal year
  fastify.get<{ Params: { orgId: string; fyId: string } }>(
    "/:orgId/fiscal-years/:fyId",
    async (request, reply) => {
      const fy = await fyRepo.findById(request.params.fyId, request.params.orgId);
      if (!fy) {
        return reply.status(404).send({ error: "Räkenskapsåret hittades inte" });
      }
      return { data: fy };
    },
  );

  // Create fiscal year
  fastify.post<{ Params: { orgId: string } }>("/:orgId/fiscal-years", async (request, reply) => {
    const data = parseBody(createFiscalYearSchema, request.body);

    const result = await fyRepo.create({
      organizationId: request.params.orgId,
      startDate: data.startDate,
      endDate: data.endDate,
    });

    if (!result.ok) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.status(201).send({ data: result.value });
  });

  // Close fiscal year (creates closing voucher + marks as closed)
  fastify.patch<{ Params: { orgId: string; fyId: string } }>(
    "/:orgId/fiscal-years/:fyId/close",
    async (request, reply) => {
      const result = await fyRepo.close(request.params.fyId, request.params.orgId);

      if (!result.ok) {
        if (result.error.code === "NOT_FOUND") {
          return reply.status(404).send({ error: result.error });
        }
        return reply.status(400).send({ error: result.error });
      }

      return { data: result.value };
    },
  );

  // Create opening balances from previous fiscal year
  fastify.post<{
    Params: { orgId: string; fyId: string };
    Body: { previousFiscalYearId: string };
  }>("/:orgId/fiscal-years/:fyId/opening-balances", async (request, reply) => {
    const data = parseBody(openingBalancesSchema, request.body);

    const result = await fyRepo.createOpeningBalances(
      request.params.fyId,
      data.previousFiscalYearId,
      request.params.orgId,
    );

    if (!result.ok) {
      if (result.error.code === "NOT_FOUND") {
        return reply.status(404).send({ error: result.error });
      }
      return reply.status(400).send({ error: result.error });
    }

    return reply.status(201).send({ data: result.value });
  });
}
