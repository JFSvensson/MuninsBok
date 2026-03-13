import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  VoucherTemplate,
  CreateVoucherTemplateInput,
  UpdateVoucherTemplateInput,
  VoucherTemplateError,
  IVoucherTemplateRepository,
} from "@muninsbok/core/types";
import { ok, err, type Result, validateVoucherTemplate } from "@muninsbok/core/types";
import { toVoucherTemplate } from "../mappers.js";

const includeLines = { lines: true } as const;

export class VoucherTemplateRepository implements IVoucherTemplateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByOrganization(organizationId: string): Promise<VoucherTemplate[]> {
    const templates = await this.prisma.voucherTemplate.findMany({
      where: { organizationId },
      include: includeLines,
      orderBy: { name: "asc" },
    });
    return templates.map(toVoucherTemplate);
  }

  async findById(id: string, organizationId: string): Promise<VoucherTemplate | null> {
    const template = await this.prisma.voucherTemplate.findFirst({
      where: { id, organizationId },
      include: includeLines,
    });
    return template ? toVoucherTemplate(template) : null;
  }

  async findDueRecurring(organizationId: string, asOf: Date): Promise<VoucherTemplate[]> {
    const templates = await this.prisma.voucherTemplate.findMany({
      where: {
        organizationId,
        isRecurring: true,
        nextRunDate: { lte: asOf },
        OR: [{ recurringEndDate: null }, { recurringEndDate: { gte: asOf } }],
      },
      include: includeLines,
      orderBy: { nextRunDate: "asc" },
    });
    return templates.map(toVoucherTemplate);
  }

  async create(
    organizationId: string,
    input: CreateVoucherTemplateInput,
  ): Promise<Result<VoucherTemplate, VoucherTemplateError>> {
    // Validate input
    const validationError = validateVoucherTemplate(input);
    if (validationError) {
      return err(validationError);
    }

    // Check for duplicate name
    const existing = await this.prisma.voucherTemplate.findFirst({
      where: { organizationId, name: input.name },
    });
    if (existing) {
      return err({
        code: "DUPLICATE_NAME",
        message: `En mall med namnet "${input.name}" finns redan`,
      });
    }

    const template = await this.prisma.voucherTemplate.create({
      data: {
        organizationId,
        name: input.name,
        ...(input.description != null && { description: input.description }),
        lines: {
          create: input.lines.map((line) => ({
            accountNumber: line.accountNumber,
            debit: line.debit,
            credit: line.credit,
            ...(line.description != null && { description: line.description }),
          })),
        },
      },
      include: includeLines,
    });

    return ok(toVoucherTemplate(template));
  }

  async update(
    id: string,
    organizationId: string,
    input: UpdateVoucherTemplateInput,
  ): Promise<Result<VoucherTemplate, VoucherTemplateError>> {
    // Check existence
    const existing = await this.prisma.voucherTemplate.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      return err({ code: "NOT_FOUND", message: "Mallen hittades inte" });
    }

    // If name is being changed, check for duplicate
    if (input.name != null && input.name !== existing.name) {
      const duplicate = await this.prisma.voucherTemplate.findFirst({
        where: { organizationId, name: input.name, id: { not: id } },
      });
      if (duplicate) {
        return err({
          code: "DUPLICATE_NAME",
          message: `En mall med namnet "${input.name}" finns redan`,
        });
      }
    }

    // Validate lines if provided
    if (input.lines != null) {
      const validationError = validateVoucherTemplate({
        name: input.name ?? existing.name,
        lines: input.lines,
      });
      if (validationError) {
        return err(validationError);
      }
    }

    // Transaction: update template + replace lines if provided
    const template = await this.prisma.$transaction(async (tx) => {
      // Delete old lines if replacing
      if (input.lines != null) {
        await tx.voucherTemplateLine.deleteMany({ where: { templateId: id } });
      }

      return tx.voucherTemplate.update({
        where: { id },
        data: {
          ...(input.name != null && { name: input.name }),
          ...(input.description !== undefined && { description: input.description ?? null }),
          ...(input.lines != null && {
            lines: {
              create: input.lines.map((line) => ({
                accountNumber: line.accountNumber,
                debit: line.debit,
                credit: line.credit,
                ...(line.description != null && { description: line.description }),
              })),
            },
          }),
        },
        include: includeLines,
      });
    });

    return ok(toVoucherTemplate(template));
  }

  async updateRecurringSchedule(
    id: string,
    organizationId: string,
    schedule: {
      isRecurring: boolean;
      frequency?: "MONTHLY" | "QUARTERLY";
      dayOfMonth?: number;
      nextRunDate?: Date;
      recurringEndDate?: Date | null;
    },
  ): Promise<VoucherTemplate | null> {
    const existing = await this.prisma.voucherTemplate.findFirst({
      where: { id, organizationId },
    });
    if (!existing) return null;

    const data: Record<string, unknown> = {
      isRecurring: schedule.isRecurring,
      frequency: schedule.isRecurring ? (schedule.frequency ?? null) : null,
      dayOfMonth: schedule.isRecurring ? (schedule.dayOfMonth ?? null) : null,
      nextRunDate: schedule.isRecurring ? (schedule.nextRunDate ?? null) : null,
      recurringEndDate: schedule.recurringEndDate ?? null,
    };

    const template = await this.prisma.voucherTemplate.update({
      where: { id },
      data,
      include: includeLines,
    });

    return toVoucherTemplate(template);
  }

  async markRecurringRun(id: string, nextRunDate: Date): Promise<void> {
    await this.prisma.voucherTemplate.update({
      where: { id },
      data: {
        lastRunDate: new Date(),
        nextRunDate,
      },
    });
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const template = await this.prisma.voucherTemplate.findFirst({
      where: { id, organizationId },
    });
    if (!template) return false;

    await this.prisma.voucherTemplate.delete({ where: { id } });
    return true;
  }
}
