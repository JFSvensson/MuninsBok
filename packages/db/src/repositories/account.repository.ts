import type { PrismaClient } from "@prisma/client";
import type { Account, CreateAccountInput, AccountError } from "@muninsbok/core";
import { ok, err, type Result, isValidAccountNumber } from "@muninsbok/core";
import { toAccount } from "../mappers.js";

export class AccountRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByOrganization(organizationId: string): Promise<Account[]> {
    const accounts = await this.prisma.account.findMany({
      where: { organizationId },
      orderBy: { number: "asc" },
    });
    return accounts.map(toAccount);
  }

  async findActive(organizationId: string): Promise<Account[]> {
    const accounts = await this.prisma.account.findMany({
      where: { organizationId, isActive: true },
      orderBy: { number: "asc" },
    });
    return accounts.map(toAccount);
  }

  async findByNumber(
    organizationId: string,
    number: string
  ): Promise<Account | null> {
    const account = await this.prisma.account.findUnique({
      where: {
        organizationId_number: { organizationId, number },
      },
    });
    return account ? toAccount(account) : null;
  }

  async create(
    organizationId: string,
    input: CreateAccountInput
  ): Promise<Result<Account, AccountError>> {
    if (!isValidAccountNumber(input.number)) {
      return err({
        code: "INVALID_NUMBER",
        message: "Kontonumret måste vara 4 siffror (1000-8999)",
      });
    }

    if (!input.name || input.name.trim().length === 0) {
      return err({
        code: "INVALID_NAME",
        message: "Kontonamn måste anges",
      });
    }

    // Check for duplicate
    const existing = await this.prisma.account.findUnique({
      where: {
        organizationId_number: { organizationId, number: input.number },
      },
    });

    if (existing) {
      return err({
        code: "DUPLICATE_NUMBER",
        message: `Konto ${input.number} finns redan`,
      });
    }

    const account = await this.prisma.account.create({
      data: {
        organizationId,
        number: input.number,
        name: input.name.trim(),
        type: input.type,
        isVatAccount: input.isVatAccount ?? false,
        isActive: true,
      },
    });

    return ok(toAccount(account));
  }

  async createMany(
    organizationId: string,
    inputs: CreateAccountInput[]
  ): Promise<number> {
    const result = await this.prisma.account.createMany({
      data: inputs.map((input) => ({
        organizationId,
        number: input.number,
        name: input.name,
        type: input.type,
        isVatAccount: input.isVatAccount ?? false,
        isActive: true,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async deactivate(organizationId: string, number: string): Promise<boolean> {
    try {
      await this.prisma.account.update({
        where: {
          organizationId_number: { organizationId, number },
        },
        data: { isActive: false },
      });
      return true;
    } catch {
      return false;
    }
  }
}
