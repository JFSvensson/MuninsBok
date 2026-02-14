import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  Document,
  CreateDocumentInput,
  DocumentError,
} from "@muninsbok/core";
import { ok, err, type Result, isAllowedMimeType } from "@muninsbok/core";
import { toDocument } from "../mappers.js";

export class DocumentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string, organizationId: string): Promise<Document | null> {
    const doc = await this.prisma.document.findFirst({
      where: { id, organizationId },
    });
    return doc ? toDocument(doc) : null;
  }

  async findByVoucher(voucherId: string, organizationId: string): Promise<Document[]> {
    const docs = await this.prisma.document.findMany({
      where: { voucherId, organizationId },
      orderBy: { createdAt: "asc" },
    });
    return docs.map(toDocument);
  }

  async findByOrganization(organizationId: string): Promise<Document[]> {
    const docs = await this.prisma.document.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
    return docs.map(toDocument);
  }

  async create(
    input: CreateDocumentInput
  ): Promise<Result<Document, DocumentError>> {
    if (!isAllowedMimeType(input.mimeType)) {
      return err({
        code: "INVALID_MIME_TYPE",
        message: `Filtypen ${input.mimeType} stöds inte`,
      });
    }

    if (!input.filename || input.filename.trim().length === 0) {
      return err({
        code: "INVALID_FILENAME",
        message: "Filnamnet får inte vara tomt",
      });
    }

    const doc = await this.prisma.document.create({
      data: {
        organizationId: input.organizationId,
        ...(input.voucherId != null && { voucherId: input.voucherId }),
        filename: input.filename,
        mimeType: input.mimeType,
        storageKey: input.storageKey,
        size: input.size,
      },
    });

    return ok(toDocument(doc));
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const doc = await this.prisma.document.findFirst({
      where: { id, organizationId },
    });
    if (!doc) return false;

    await this.prisma.document.delete({ where: { id } });
    return true;
  }
}
