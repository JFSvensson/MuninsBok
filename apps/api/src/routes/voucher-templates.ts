import type { FastifyInstance } from "fastify";
import type { UpdateVoucherTemplateInput } from "@muninsbok/core/types";
import { createVoucherTemplateSchema, updateVoucherTemplateSchema } from "../schemas/index.js";
import { parseBody } from "../utils/parse-body.js";

export async function voucherTemplateRoutes(fastify: FastifyInstance) {
  const templateRepo = fastify.repos.voucherTemplates;

  // List templates for organization
  fastify.get<{ Params: { orgId: string } }>("/:orgId/templates", async (request) => {
    const templates = await templateRepo.findByOrganization(request.params.orgId);
    return { data: templates };
  });

  // Get single template
  fastify.get<{ Params: { orgId: string; templateId: string } }>(
    "/:orgId/templates/:templateId",
    async (request, reply) => {
      const template = await templateRepo.findById(request.params.templateId, request.params.orgId);
      if (!template) {
        return reply.status(404).send({ error: "Mallen hittades inte" });
      }
      return { data: template };
    },
  );

  // Create template
  fastify.post<{ Params: { orgId: string } }>("/:orgId/templates", async (request, reply) => {
    const parsed = parseBody(createVoucherTemplateSchema, request.body);

    const result = await templateRepo.create(request.params.orgId, {
      name: parsed.name,
      ...(parsed.description != null && { description: parsed.description }),
      lines: parsed.lines.map((l) => ({
        accountNumber: l.accountNumber,
        debit: l.debit,
        credit: l.credit,
        ...(l.description != null && { description: l.description }),
      })),
    });

    if (!result.ok) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.status(201).send({ data: result.value });
  });

  // Update template
  fastify.put<{ Params: { orgId: string; templateId: string } }>(
    "/:orgId/templates/:templateId",
    async (request, reply) => {
      const parsed = parseBody(updateVoucherTemplateSchema, request.body);

      const input: UpdateVoucherTemplateInput = {
        ...(parsed.name != null && { name: parsed.name }),
        // Only include description if it was explicitly sent (null → clear, string → set)
        ...(parsed.description !== undefined &&
          parsed.description !== null && { description: parsed.description }),
        ...(parsed.lines != null && {
          lines: parsed.lines.map((l) => ({
            accountNumber: l.accountNumber,
            debit: l.debit,
            credit: l.credit,
            ...(l.description != null && { description: l.description }),
          })),
        }),
      };

      const result = await templateRepo.update(
        request.params.templateId,
        request.params.orgId,
        input,
      );

      if (!result.ok) {
        const status = result.error.code === "NOT_FOUND" ? 404 : 400;
        return reply.status(status).send({ error: result.error });
      }

      return { data: result.value };
    },
  );

  // Delete template
  fastify.delete<{ Params: { orgId: string; templateId: string } }>(
    "/:orgId/templates/:templateId",
    async (request, reply) => {
      const deleted = await templateRepo.delete(request.params.templateId, request.params.orgId);
      if (!deleted) {
        return reply.status(404).send({ error: "Mallen hittades inte" });
      }
      return reply.status(204).send();
    },
  );
}
