import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { isAllowedMimeType } from "@muninsbok/core";
import { DocumentStorage } from "../services/document-storage.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function documentRoutes(fastify: FastifyInstance) {
  await fastify.register(multipart, { limits: { fileSize: MAX_FILE_SIZE } });

  const documentRepo = fastify.repos.documents;
  const storage = new DocumentStorage();

  // List documents for a voucher
  fastify.get<{ Params: { orgId: string; voucherId: string } }>(
    "/:orgId/vouchers/:voucherId/documents",
    async (request) => {
      const docs = await documentRepo.findByVoucher(request.params.voucherId, request.params.orgId);
      return { data: docs };
    },
  );

  // Upload document to a voucher
  fastify.post<{ Params: { orgId: string; voucherId: string } }>(
    "/:orgId/vouchers/:voucherId/documents",
    async (request, reply) => {
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ error: "Ingen fil bifogad" });
      }

      if (!isAllowedMimeType(file.mimetype)) {
        return reply.status(400).send({
          error: `Filtypen ${file.mimetype} stöds inte. Tillåtna: PDF, JPEG, PNG, WebP, HEIC`,
        });
      }

      const data = await file.toBuffer();
      const storageKey = storage.generateStorageKey(request.params.orgId, file.filename);

      await storage.store(storageKey, data);

      const result = await documentRepo.create({
        organizationId: request.params.orgId,
        voucherId: request.params.voucherId,
        filename: file.filename,
        mimeType: file.mimetype,
        storageKey,
        size: data.length,
      });

      if (!result.ok) {
        // Clean up stored file on DB error
        await storage.remove(storageKey);
        return reply.status(400).send({ error: result.error });
      }

      return reply.status(201).send({ data: result.value });
    },
  );

  // Download document
  fastify.get<{ Params: { orgId: string; documentId: string } }>(
    "/:orgId/documents/:documentId/download",
    async (request, reply) => {
      const doc = await documentRepo.findById(request.params.documentId, request.params.orgId);
      if (!doc) {
        return reply.status(404).send({ error: "Dokumentet hittades inte" });
      }

      const data = await storage.read(doc.storageKey);
      return reply
        .header("Content-Type", doc.mimeType)
        .header("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.filename)}"`)
        .send(data);
    },
  );

  // Delete document
  fastify.delete<{ Params: { orgId: string; documentId: string } }>(
    "/:orgId/documents/:documentId",
    async (request, reply) => {
      const doc = await documentRepo.findById(request.params.documentId, request.params.orgId);
      if (!doc) {
        return reply.status(404).send({ error: "Dokumentet hittades inte" });
      }

      // BFL: Prevent deletion of documents attached to vouchers in closed fiscal years
      if (doc.voucherId) {
        const voucher = await fastify.repos.prisma.voucher.findFirst({
          where: { id: doc.voucherId, organizationId: request.params.orgId },
          select: { fiscalYearId: true },
        });
        if (voucher) {
          const fiscalYear = await fastify.repos.prisma.fiscalYear.findFirst({
            where: { id: voucher.fiscalYearId, organizationId: request.params.orgId },
            select: { isClosed: true },
          });
          if (fiscalYear?.isClosed) {
            return reply.status(403).send({
              error: "Kan inte radera dokument som tillhör ett stängt räkenskapsår",
              code: "FISCAL_YEAR_CLOSED",
            });
          }
        }
      }

      await storage.remove(doc.storageKey);
      await documentRepo.delete(doc.id, request.params.orgId);

      return reply.status(204).send();
    },
  );
}
