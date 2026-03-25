import type { Voucher } from "@muninsbok/core/types";
import { AppError } from "../utils/app-error.js";
import type { Repositories } from "../repositories.js";

export interface BankMatchCandidate {
  voucherId: string;
  voucherNumber: number;
  fiscalYearId: string;
  date: Date;
  description: string;
  score: number;
  reasons: string[];
}

export interface CreateVoucherFromBankTransactionInput {
  organizationId: string;
  transactionId: string;
  fiscalYearId?: string;
  bankAccountNumber: string;
  counterAccountNumber: string;
  description?: string;
  matchNote?: string;
  createdBy?: string;
}

export interface MatchBankTransactionInput {
  organizationId: string;
  transactionId: string;
  voucherId: string;
  matchConfidence?: number;
  matchNote?: string;
}

interface BankTransactionMatchingServiceDeps {
  repos: Pick<Repositories, "bankTransactions" | "vouchers" | "fiscalYears">;
}

const CANDIDATE_SEARCH_WINDOW_DAYS = 7;

export class BankTransactionMatchingService {
  constructor(private readonly deps: BankTransactionMatchingServiceDeps) {}

  async getMatchCandidates(
    organizationId: string,
    transactionId: string,
    limit: number,
  ): Promise<BankMatchCandidate[]> {
    const tx = await this.requireTransaction(organizationId, transactionId);
    const bookedAt = tx.bookedAt;

    const fromDate = new Date(bookedAt.getTime() - CANDIDATE_SEARCH_WINDOW_DAYS * 86400000);
    const toDate = new Date(bookedAt.getTime() + CANDIDATE_SEARCH_WINDOW_DAYS * 86400000);
    const vouchers = await this.deps.repos.vouchers.findByDateRange(
      organizationId,
      fromDate,
      toDate,
    );

    return vouchers
      .map((voucher) => this.scoreCandidate(voucher, tx.amountOre, tx.description, bookedAt))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async matchTransaction(input: MatchBankTransactionInput) {
    const tx = await this.requireTransaction(input.organizationId, input.transactionId);
    const voucher = await this.deps.repos.vouchers.findById(input.voucherId, input.organizationId);

    if (!voucher) {
      throw AppError.notFound("Verifikatet");
    }

    const closedYear = await this.deps.repos.vouchers.isVoucherInClosedFiscalYear(
      input.voucherId,
      input.organizationId,
    );
    if (closedYear) {
      throw AppError.badRequest(
        "Kan inte matcha mot ett verifikat i stängt räkenskapsår",
        "BANK_VOUCHER_FISCAL_YEAR_CLOSED",
      );
    }

    if (tx.matchedVoucherId && tx.matchedVoucherId !== input.voucherId) {
      throw AppError.conflict("Transaktionen är redan matchad mot ett annat verifikat");
    }

    const updated = await this.deps.repos.bankTransactions.updateMatch(
      tx.id,
      input.organizationId,
      {
        status: tx.matchStatus === "CONFIRMED" ? "CONFIRMED" : "MATCHED",
        matchedVoucherId: input.voucherId,
        ...(input.matchConfidence != null && { matchConfidence: input.matchConfidence }),
        ...(input.matchNote != null && { matchNote: input.matchNote }),
      },
    );

    if (!updated) {
      throw AppError.notFound("Banktransaktionen");
    }

    return { transaction: updated, voucher };
  }

  async unmatchTransaction(organizationId: string, transactionId: string) {
    const tx = await this.requireTransaction(organizationId, transactionId);
    const updated = await this.deps.repos.bankTransactions.updateMatch(tx.id, organizationId, {
      status: "PENDING_MATCH",
      matchedVoucherId: null,
      matchConfidence: null,
      matchNote: null,
    });

    if (!updated) {
      throw AppError.notFound("Banktransaktionen");
    }

    return updated;
  }

  async confirmTransaction(organizationId: string, transactionId: string, matchNote?: string) {
    const tx = await this.requireTransaction(organizationId, transactionId);
    if (!tx.matchedVoucherId) {
      throw AppError.badRequest(
        "Transaktionen måste vara matchad innan den kan bekräftas",
        "BANK_TRANSACTION_NOT_MATCHED",
      );
    }

    const updated = await this.deps.repos.bankTransactions.updateMatch(tx.id, organizationId, {
      status: "CONFIRMED",
      matchedVoucherId: tx.matchedVoucherId,
      ...(tx.matchConfidence != null && { matchConfidence: tx.matchConfidence }),
      ...(matchNote != null && { matchNote }),
    });

    if (!updated) {
      throw AppError.notFound("Banktransaktionen");
    }

    return updated;
  }

  async createVoucherFromTransaction(input: CreateVoucherFromBankTransactionInput) {
    const tx = await this.requireTransaction(input.organizationId, input.transactionId);

    if (tx.matchedVoucherId) {
      throw AppError.conflict("Transaktionen är redan matchad till ett verifikat");
    }

    const fiscalYearId =
      input.fiscalYearId ?? (await this.resolveOpenFiscalYearId(input.organizationId, tx.bookedAt));
    const amount = Math.abs(tx.amountOre);

    if (amount === 0) {
      throw AppError.badRequest(
        "Transaktion med 0-belopp kan inte bokföras",
        "BANK_TRANSACTION_ZERO_AMOUNT",
      );
    }

    const isOutgoing = tx.amountOre < 0;
    const voucherResult = await this.deps.repos.vouchers.create({
      organizationId: input.organizationId,
      fiscalYearId,
      date: tx.bookedAt,
      description: input.description ?? `Banktransaktion: ${tx.description}`,
      lines: [
        {
          accountNumber: isOutgoing ? input.counterAccountNumber : input.bankAccountNumber,
          debit: amount,
          credit: 0,
          description: tx.description,
        },
        {
          accountNumber: isOutgoing ? input.bankAccountNumber : input.counterAccountNumber,
          debit: 0,
          credit: amount,
          description: tx.description,
        },
      ],
      ...(input.createdBy != null && { createdBy: input.createdBy }),
    });

    if (!voucherResult.ok) {
      throw AppError.badRequest(voucherResult.error.message, voucherResult.error.code);
    }

    const updated = await this.deps.repos.bankTransactions.updateMatch(
      tx.id,
      input.organizationId,
      {
        status: "CONFIRMED",
        matchedVoucherId: voucherResult.value.id,
        matchConfidence: 100,
        matchNote:
          input.matchNote ??
          `Automatiskt skapat verifikat #${voucherResult.value.number} från banktransaktion`,
      },
    );

    if (!updated) {
      throw AppError.internal("Kunde inte uppdatera matchstatus efter verifikatskapande");
    }

    return {
      voucher: voucherResult.value,
      transaction: updated,
    };
  }

  private async requireTransaction(organizationId: string, transactionId: string) {
    const tx = await this.deps.repos.bankTransactions.findById(transactionId, organizationId);
    if (!tx) {
      throw AppError.notFound("Banktransaktionen");
    }

    return tx;
  }

  private async resolveOpenFiscalYearId(organizationId: string, bookedAt: Date): Promise<string> {
    const years = await this.deps.repos.fiscalYears.findByOrganization(organizationId);
    const fiscalYear = years.find(
      (year) => !year.isClosed && year.startDate <= bookedAt && year.endDate >= bookedAt,
    );

    if (!fiscalYear) {
      throw AppError.badRequest(
        "Inget öppet räkenskapsår hittades för transaktionsdatumet",
        "BANK_FISCAL_YEAR_NOT_FOUND",
      );
    }

    return fiscalYear.id;
  }

  private scoreCandidate(
    voucher: Voucher,
    amountOre: number,
    description: string,
    bookedAt: Date,
  ): BankMatchCandidate {
    const absAmount = Math.abs(amountOre);
    const reasons: string[] = [];
    let score = 0;

    const lineAmounts = voucher.lines.flatMap((line) => [line.debit, line.credit]);
    if (lineAmounts.some((n) => n === absAmount)) {
      score += 60;
      reasons.push("Belopp matchar exakt");
    } else if (lineAmounts.some((n) => Math.abs(n - absAmount) <= 100)) {
      score += 35;
      reasons.push("Belopp matchar nära");
    }

    const dayDiff = Math.abs(daysBetween(voucher.date, bookedAt));
    if (dayDiff === 0) {
      score += 20;
      reasons.push("Samma datum");
    } else if (dayDiff <= 3) {
      score += 12;
      reasons.push("Närliggande datum");
    }

    const normalizedVoucherDesc = voucher.description.toLowerCase();
    const normalizedTxDesc = description.toLowerCase();
    if (
      normalizedTxDesc.length > 2 &&
      (normalizedVoucherDesc.includes(normalizedTxDesc) ||
        normalizedTxDesc.includes(normalizedVoucherDesc))
    ) {
      score += 20;
      reasons.push("Liknande beskrivning");
    }

    return {
      voucherId: voucher.id,
      voucherNumber: voucher.number,
      fiscalYearId: voucher.fiscalYearId,
      date: voucher.date,
      description: voucher.description,
      score,
      reasons,
    };
  }
}

function daysBetween(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const utcB = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((utcA - utcB) / 86400000);
}

export function createBankTransactionMatchingService(deps: BankTransactionMatchingServiceDeps) {
  return new BankTransactionMatchingService(deps);
}
