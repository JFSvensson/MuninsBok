import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  IInvoiceRepository,
  Invoice,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  InvoiceError,
  Result,
} from "@muninsbok/core/types";
import { ok, err } from "@muninsbok/core/types";
import { calculateLineAmount, calculateInvoiceTotals } from "@muninsbok/core";
import { toInvoice } from "../mappers.js";

const invoiceInclude = { lines: true } as const;

export class InvoiceRepository implements IInvoiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByOrganization(organizationId: string): Promise<Invoice[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: { organizationId },
      include: invoiceInclude,
      orderBy: { invoiceNumber: "desc" },
    });
    return invoices.map(toInvoice);
  }

  async findById(id: string, organizationId: string): Promise<Invoice | null> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId },
      include: invoiceInclude,
    });
    return invoice ? toInvoice(invoice) : null;
  }

  async findByCustomer(customerId: string, organizationId: string): Promise<Invoice[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: { customerId, organizationId },
      include: invoiceInclude,
      orderBy: { invoiceNumber: "desc" },
    });
    return invoices.map(toInvoice);
  }

  async findByStatus(organizationId: string, status: string): Promise<Invoice[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: { organizationId, status: status as never },
      include: invoiceInclude,
      orderBy: { invoiceNumber: "desc" },
    });
    return invoices.map(toInvoice);
  }

  async getNextInvoiceNumber(organizationId: string): Promise<number> {
    const last = await this.prisma.invoice.findFirst({
      where: { organizationId },
      orderBy: { invoiceNumber: "desc" },
      select: { invoiceNumber: true },
    });
    return (last?.invoiceNumber ?? 0) + 1;
  }

  async create(
    organizationId: string,
    input: CreateInvoiceInput,
  ): Promise<Result<Invoice, InvoiceError>> {
    if (input.lines.length === 0) {
      return err({ code: "EMPTY_LINES", message: "Fakturan måste ha minst en rad" });
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: input.customerId, organizationId },
    });
    if (!customer) {
      return err({ code: "CUSTOMER_NOT_FOUND", message: "Kunden hittades inte" });
    }

    const invoiceNumber = await this.getNextInvoiceNumber(organizationId);
    const totals = calculateInvoiceTotals(input.lines);

    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId,
        customerId: input.customerId,
        invoiceNumber,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        ourReference: input.ourReference ?? null,
        yourReference: input.yourReference ?? null,
        notes: input.notes ?? null,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        totalAmount: totals.totalAmount,
        lines: {
          create: input.lines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            vatRate: line.vatRate,
            amount: calculateLineAmount(line.quantity, line.unitPrice),
            accountNumber: line.accountNumber ?? null,
          })),
        },
      },
      include: invoiceInclude,
    });

    return ok(toInvoice(invoice));
  }

  async update(
    id: string,
    organizationId: string,
    input: UpdateInvoiceInput,
  ): Promise<Result<Invoice, InvoiceError>> {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return err({ code: "NOT_FOUND", message: "Fakturan hittades inte" });
    }
    if (existing.status !== "DRAFT") {
      return err({ code: "NOT_DRAFT", message: "Bara utkast kan redigeras" });
    }

    if (input.customerId !== undefined) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: input.customerId, organizationId },
      });
      if (!customer) {
        return err({ code: "CUSTOMER_NOT_FOUND", message: "Kunden hittades inte" });
      }
    }

    // If lines are updated, recalculate totals and replace all lines
    let lineData: Record<string, unknown> | undefined;
    let totals: { subtotal: number; vatAmount: number; totalAmount: number } | undefined;

    if (input.lines !== undefined) {
      if (input.lines.length === 0) {
        return err({ code: "EMPTY_LINES", message: "Fakturan måste ha minst en rad" });
      }
      totals = calculateInvoiceTotals(input.lines);
      // Delete existing lines and create new ones
      await this.prisma.invoiceLine.deleteMany({ where: { invoiceId: id } });
      lineData = {
        create: input.lines.map((line) => ({
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          vatRate: line.vatRate,
          amount: calculateLineAmount(line.quantity, line.unitPrice),
          accountNumber: line.accountNumber ?? null,
        })),
      };
    }

    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: {
        ...(input.customerId !== undefined && { customerId: input.customerId }),
        ...(input.issueDate !== undefined && { issueDate: input.issueDate }),
        ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
        ...(input.ourReference !== undefined && { ourReference: input.ourReference }),
        ...(input.yourReference !== undefined && { yourReference: input.yourReference }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(totals && {
          subtotal: totals.subtotal,
          vatAmount: totals.vatAmount,
          totalAmount: totals.totalAmount,
        }),
        ...(lineData && { lines: lineData }),
      },
      include: invoiceInclude,
    });

    return ok(toInvoice(invoice));
  }

  async updateStatus(
    id: string,
    organizationId: string,
    status: string,
    extra?: { paidDate?: Date; sentAt?: Date; voucherId?: string },
  ): Promise<Result<Invoice, InvoiceError>> {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, organizationId },
      include: invoiceInclude,
    });
    if (!existing) {
      return err({ code: "NOT_FOUND", message: "Fakturan hittades inte" });
    }

    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: status as never,
        ...(extra?.paidDate && { paidDate: extra.paidDate }),
        ...(extra?.sentAt && { sentAt: extra.sentAt }),
        ...(extra?.voucherId && { voucherId: extra.voucherId }),
      },
      include: invoiceInclude,
    });

    return ok(toInvoice(invoice));
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, organizationId },
    });
    if (!existing) return false;
    if (existing.status !== "DRAFT") return false;

    await this.prisma.invoice.delete({ where: { id } });
    return true;
  }
}
