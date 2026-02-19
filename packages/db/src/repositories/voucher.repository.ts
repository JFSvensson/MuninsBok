import type { PrismaClient } from "../generated/prisma/client.js";
import type { Voucher, CreateVoucherInput, VoucherError } from "@muninsbok/core";
import { ok, err, type Result, validateVoucher } from "@muninsbok/core";
import { toVoucher, toAccount, toFiscalYear } from "../mappers.js";

const voucherInclude = {
  lines: true,
  documents: true,
  correctedByVoucher: true,
} as const;

export class VoucherRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string, organizationId: string): Promise<Voucher | null> {
    const voucher = await this.prisma.voucher.findFirst({
      where: { id, organizationId },
      include: voucherInclude,
    });
    return voucher ? toVoucher(voucher) : null;
  }

  async findByFiscalYear(fiscalYearId: string, organizationId: string): Promise<Voucher[]> {
    const vouchers = await this.prisma.voucher.findMany({
      where: { fiscalYearId, organizationId },
      include: voucherInclude,
      orderBy: [{ number: "asc" }],
    });
    return vouchers.map(toVoucher);
  }

  /**
   * Paginated voucher list with optional search.
   */
  async findByFiscalYearPaginated(
    fiscalYearId: string,
    organizationId: string,
    options: { page: number; limit: number; search?: string },
  ): Promise<{ vouchers: Voucher[]; total: number; page: number; limit: number }> {
    const { page, limit, search } = options;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { fiscalYearId, organizationId };

    if (search) {
      const asNumber = Number(search);
      where["OR"] = [
        { description: { contains: search, mode: "insensitive" } },
        ...(!isNaN(asNumber) ? [{ number: asNumber }] : []),
      ];
    }

    const [vouchers, total] = await Promise.all([
      this.prisma.voucher.findMany({
        where,
        include: voucherInclude,
        orderBy: [{ number: "asc" }],
        skip,
        take: limit,
      }),
      this.prisma.voucher.count({ where }),
    ]);

    return { vouchers: vouchers.map(toVoucher), total, page, limit };
  }

  async findByDateRange(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Voucher[]> {
    const vouchers = await this.prisma.voucher.findMany({
      where: {
        organizationId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: voucherInclude,
      orderBy: [{ date: "asc" }, { number: "asc" }],
    });
    return vouchers.map(toVoucher);
  }

  async create(input: CreateVoucherInput): Promise<Result<Voucher, VoucherError>> {
    // Get fiscal year and accounts for validation
    const [fiscalYear, accounts] = await Promise.all([
      this.prisma.fiscalYear.findFirst({
        where: {
          id: input.fiscalYearId,
          organizationId: input.organizationId,
        },
      }),
      this.prisma.account.findMany({
        where: {
          organizationId: input.organizationId,
          isActive: true,
        },
      }),
    ]);

    if (!fiscalYear) {
      return err({
        code: "NOT_FOUND",
        message: "Räkenskapsåret hittades inte",
      });
    }

    // Validate using core logic
    const validation = validateVoucher(input, {
      fiscalYear: toFiscalYear(fiscalYear),
      accounts: accounts.map(toAccount),
    });

    if (!validation.ok) {
      return validation;
    }

    // Get next voucher number
    const nextNumber = await this.getNextVoucherNumber(input.fiscalYearId);

    // Build account lookup for IDs
    const accountMap = new Map(accounts.map((a) => [a.number, a.id]));

    // Create voucher with lines in transaction
    const voucher = await this.prisma.voucher.create({
      data: {
        organizationId: input.organizationId,
        fiscalYearId: input.fiscalYearId,
        number: nextNumber,
        date: input.date,
        description: input.description,
        ...(input.createdBy != null && { createdBy: input.createdBy }),
        lines: {
          create: input.lines.map((line) => ({
            accountId: accountMap.get(line.accountNumber)!,
            accountNumber: line.accountNumber,
            debit: line.debit,
            credit: line.credit,
            ...(line.description != null && { description: line.description }),
          })),
        },
        documents: input.documentIds
          ? {
              connect: input.documentIds.map((id) => ({ id })),
            }
          : {},
      },
      include: voucherInclude,
    });

    return ok(toVoucher(voucher));
  }

  /**
   * Create a correction voucher (rättelseverifikat) that reverses
   * all lines of the original voucher (BFL 5:5).
   */
  async createCorrection(
    voucherId: string,
    organizationId: string,
  ): Promise<Result<Voucher, VoucherError>> {
    // Find the original voucher
    const original = await this.prisma.voucher.findFirst({
      where: { id: voucherId, organizationId },
      include: { lines: true, documents: true, correctedByVoucher: true },
    });

    if (!original) {
      return err({ code: "NOT_FOUND", message: "Verifikatet hittades inte" });
    }

    // Check if already corrected
    if (original.correctedByVoucher) {
      return err({
        code: "ALREADY_CORRECTED",
        message: "Verifikatet har redan rättats",
      });
    }

    // Get next voucher number
    const nextNumber = await this.getNextVoucherNumber(original.fiscalYearId);

    // Create correction voucher with reversed lines
    const correction = await this.prisma.voucher.create({
      data: {
        organizationId,
        fiscalYearId: original.fiscalYearId,
        number: nextNumber,
        date: new Date(),
        description: `Rättelse av verifikat #${original.number}`,
        correctsVoucherId: original.id,
        lines: {
          create: original.lines.map((line) => ({
            accountId: line.accountId,
            accountNumber: line.accountNumber,
            debit: line.credit, // Swap debit/credit
            credit: line.debit,
          })),
        },
      },
      include: voucherInclude,
    });

    return ok(toVoucher(correction));
  }

  async getNextVoucherNumber(fiscalYearId: string): Promise<number> {
    const lastVoucher = await this.prisma.voucher.findFirst({
      where: { fiscalYearId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    return (lastVoucher?.number ?? 0) + 1;
  }

  /**
   * Find gaps in the voucher number sequence for a fiscal year.
   * Returns an array of missing voucher numbers (BFL 5:6 – löpnumrering).
   */
  async findNumberGaps(fiscalYearId: string, organizationId: string): Promise<number[]> {
    const vouchers = await this.prisma.voucher.findMany({
      where: { fiscalYearId, organizationId },
      orderBy: { number: "asc" },
      select: { number: true },
    });

    if (vouchers.length === 0) return [];

    const numbers = new Set(vouchers.map((v) => v.number));
    const max = Math.max(...numbers);
    const gaps: number[] = [];

    for (let i = 1; i <= max; i++) {
      if (!numbers.has(i)) {
        gaps.push(i);
      }
    }

    return gaps;
  }
}
