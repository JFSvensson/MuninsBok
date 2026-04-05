import { describe, expect, it, vi, beforeEach } from "vitest";
import { BankTransactionMatchingService } from "./bank-matching.js";
import {
  createMockBankTransactionRepo,
  createMockVoucherRepo,
  createMockFiscalYearRepo,
} from "../test/helpers.js";
import { AppError } from "../utils/app-error.js";

const ORG_ID = "org-1";
const TX_ID = "tx-1";
const VOUCHER_ID = "v-1";

function baseTx(overrides?: Record<string, unknown>) {
  return {
    id: TX_ID,
    organizationId: ORG_ID,
    connectionId: "bc-1",
    providerTransactionId: "ext-tx-1",
    bookedAt: new Date("2026-03-15T00:00:00Z"),
    description: "Kortköp ICA",
    amountOre: -15000,
    currency: "SEK",
    matchStatus: "PENDING_MATCH" as const,
    matchedVoucherId: undefined,
    matchConfidence: undefined,
    matchNote: undefined,
    rawData: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function baseVoucher(overrides?: Record<string, unknown>) {
  return {
    id: VOUCHER_ID,
    fiscalYearId: "fy-1",
    organizationId: ORG_ID,
    number: 1,
    date: new Date("2026-03-15T00:00:00Z"),
    description: "Kortköp ICA",
    lines: [
      { accountNumber: "1930", debit: 15000, credit: 0, description: "ICA" },
      { accountNumber: "4010", debit: 0, credit: 15000, description: "ICA" },
    ],
    documentIds: [],
    status: "APPROVED" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildService() {
  const bankTransactions = createMockBankTransactionRepo();
  const vouchers = createMockVoucherRepo();
  const fiscalYears = createMockFiscalYearRepo();
  const service = new BankTransactionMatchingService({
    repos: { bankTransactions, vouchers, fiscalYears } as never,
  });
  return { service, bankTransactions, vouchers, fiscalYears };
}

describe("BankTransactionMatchingService", () => {
  describe("getMatchCandidates", () => {
    it("returns scored vouchers sorted by score descending", async () => {
      const { service, bankTransactions, vouchers } = buildService();
      bankTransactions.findById.mockResolvedValue(baseTx());

      const exactMatch = baseVoucher();
      const noMatch = baseVoucher({
        id: "v-2",
        number: 2,
        description: "Hyra",
        date: new Date("2026-03-10T00:00:00Z"),
        lines: [
          { accountNumber: "1930", debit: 99900, credit: 0, description: "Hyra" },
          { accountNumber: "5010", debit: 0, credit: 99900, description: "Hyra" },
        ],
      });
      vouchers.findByDateRange.mockResolvedValue([exactMatch, noMatch]);

      const candidates = await service.getMatchCandidates(ORG_ID, TX_ID, 10);

      expect(candidates.length).toBeGreaterThanOrEqual(1);
      expect(candidates[0]!.voucherId).toBe(VOUCHER_ID);
      expect(candidates[0]!.score).toBeGreaterThan(0);
      expect(candidates[0]!.reasons.length).toBeGreaterThan(0);
    });

    it("gives highest score for exact amount + same date + matching description", async () => {
      const { service, bankTransactions, vouchers } = buildService();
      bankTransactions.findById.mockResolvedValue(baseTx());
      vouchers.findByDateRange.mockResolvedValue([baseVoucher()]);

      const [candidate] = await service.getMatchCandidates(ORG_ID, TX_ID, 10);

      // Exact amount (60) + same date (20) + matching description (20) = 100
      expect(candidate!.score).toBe(100);
      expect(candidate!.reasons).toContain("Belopp matchar exakt");
      expect(candidate!.reasons).toContain("Samma datum");
      expect(candidate!.reasons).toContain("Liknande beskrivning");
    });

    it("scores partial match on near amount and nearby date", async () => {
      const { service, bankTransactions, vouchers } = buildService();
      bankTransactions.findById.mockResolvedValue(baseTx({ amountOre: -15050 }));
      vouchers.findByDateRange.mockResolvedValue([
        baseVoucher({
          date: new Date("2026-03-17T00:00:00Z"),
          description: "Something else",
        }),
      ]);

      const [candidate] = await service.getMatchCandidates(ORG_ID, TX_ID, 10);

      expect(candidate!.score).toBe(47); // near amount (35) + nearby date (12)
      expect(candidate!.reasons).toContain("Belopp matchar nära");
      expect(candidate!.reasons).toContain("Närliggande datum");
    });

    it("filters out zero-score candidates", async () => {
      const { service, bankTransactions, vouchers } = buildService();
      bankTransactions.findById.mockResolvedValue(baseTx());
      vouchers.findByDateRange.mockResolvedValue([
        baseVoucher({
          description: "Completely unrelated",
          date: new Date("2026-03-22T00:00:00Z"),
          lines: [
            { accountNumber: "1930", debit: 999999, credit: 0, description: "" },
            { accountNumber: "5010", debit: 0, credit: 999999, description: "" },
          ],
        }),
      ]);

      const candidates = await service.getMatchCandidates(ORG_ID, TX_ID, 10);

      expect(candidates).toHaveLength(0);
    });

    it("respects the limit parameter", async () => {
      const { service, bankTransactions, vouchers } = buildService();
      bankTransactions.findById.mockResolvedValue(baseTx());
      const manyVouchers = Array.from({ length: 5 }, (_, i) =>
        baseVoucher({ id: `v-${i}`, number: i + 1 }),
      );
      vouchers.findByDateRange.mockResolvedValue(manyVouchers);

      const candidates = await service.getMatchCandidates(ORG_ID, TX_ID, 2);

      expect(candidates).toHaveLength(2);
    });

    it("throws not-found when transaction does not exist", async () => {
      const { service, bankTransactions } = buildService();
      bankTransactions.findById.mockResolvedValue(null);

      await expect(service.getMatchCandidates(ORG_ID, "missing", 10)).rejects.toThrow(AppError);
    });
  });

  describe("matchTransaction", () => {
    it("matches a transaction to a voucher", async () => {
      const { service, bankTransactions, vouchers } = buildService();
      const tx = baseTx();
      bankTransactions.findById.mockResolvedValue(tx);
      vouchers.findById.mockResolvedValue(baseVoucher());
      vouchers.isVoucherInClosedFiscalYear.mockResolvedValue(false);
      const updatedTx = { ...tx, matchStatus: "MATCHED", matchedVoucherId: VOUCHER_ID };
      bankTransactions.updateMatch.mockResolvedValue(updatedTx);

      const result = await service.matchTransaction({
        organizationId: ORG_ID,
        transactionId: TX_ID,
        voucherId: VOUCHER_ID,
      });

      expect(result.transaction.matchStatus).toBe("MATCHED");
      expect(result.voucher.id).toBe(VOUCHER_ID);
      expect(bankTransactions.updateMatch).toHaveBeenCalledWith(TX_ID, ORG_ID, {
        status: "MATCHED",
        matchedVoucherId: VOUCHER_ID,
      });
    });

    it("throws not-found when voucher does not exist", async () => {
      const { service, bankTransactions, vouchers } = buildService();
      bankTransactions.findById.mockResolvedValue(baseTx());
      vouchers.findById.mockResolvedValue(null);

      await expect(
        service.matchTransaction({
          organizationId: ORG_ID,
          transactionId: TX_ID,
          voucherId: "missing",
        }),
      ).rejects.toThrow(AppError);
    });

    it("throws when voucher is in a closed fiscal year", async () => {
      const { service, bankTransactions, vouchers } = buildService();
      bankTransactions.findById.mockResolvedValue(baseTx());
      vouchers.findById.mockResolvedValue(baseVoucher());
      vouchers.isVoucherInClosedFiscalYear.mockResolvedValue(true);

      await expect(
        service.matchTransaction({
          organizationId: ORG_ID,
          transactionId: TX_ID,
          voucherId: VOUCHER_ID,
        }),
      ).rejects.toThrow(/stängt räkenskapsår/);
    });

    it("throws conflict when transaction is already matched to a different voucher", async () => {
      const { service, bankTransactions, vouchers } = buildService();
      bankTransactions.findById.mockResolvedValue(
        baseTx({ matchedVoucherId: "other-voucher", matchStatus: "MATCHED" }),
      );
      vouchers.findById.mockResolvedValue(baseVoucher());
      vouchers.isVoucherInClosedFiscalYear.mockResolvedValue(false);

      await expect(
        service.matchTransaction({
          organizationId: ORG_ID,
          transactionId: TX_ID,
          voucherId: VOUCHER_ID,
        }),
      ).rejects.toThrow(/redan matchad/);
    });

    it("preserves CONFIRMED status when re-matching to same voucher", async () => {
      const { service, bankTransactions, vouchers } = buildService();
      const tx = baseTx({ matchedVoucherId: VOUCHER_ID, matchStatus: "CONFIRMED" });
      bankTransactions.findById.mockResolvedValue(tx);
      vouchers.findById.mockResolvedValue(baseVoucher());
      vouchers.isVoucherInClosedFiscalYear.mockResolvedValue(false);
      bankTransactions.updateMatch.mockResolvedValue({
        ...tx,
        matchStatus: "CONFIRMED",
      });

      const result = await service.matchTransaction({
        organizationId: ORG_ID,
        transactionId: TX_ID,
        voucherId: VOUCHER_ID,
      });

      expect(bankTransactions.updateMatch).toHaveBeenCalledWith(TX_ID, ORG_ID, {
        status: "CONFIRMED",
        matchedVoucherId: VOUCHER_ID,
      });
      expect(result.transaction.matchStatus).toBe("CONFIRMED");
    });
  });

  describe("unmatchTransaction", () => {
    it("resets match status to PENDING_MATCH", async () => {
      const { service, bankTransactions } = buildService();
      const tx = baseTx({ matchedVoucherId: VOUCHER_ID, matchStatus: "MATCHED" });
      bankTransactions.findById.mockResolvedValue(tx);
      bankTransactions.updateMatch.mockResolvedValue({
        ...tx,
        matchStatus: "PENDING_MATCH",
        matchedVoucherId: null,
        matchConfidence: null,
        matchNote: null,
      });

      const result = await service.unmatchTransaction(ORG_ID, TX_ID);

      expect(result.matchStatus).toBe("PENDING_MATCH");
      expect(bankTransactions.updateMatch).toHaveBeenCalledWith(TX_ID, ORG_ID, {
        status: "PENDING_MATCH",
        matchedVoucherId: null,
        matchConfidence: null,
        matchNote: null,
      });
    });

    it("throws not-found when transaction does not exist", async () => {
      const { service, bankTransactions } = buildService();
      bankTransactions.findById.mockResolvedValue(null);

      await expect(service.unmatchTransaction(ORG_ID, "missing")).rejects.toThrow(AppError);
    });
  });

  describe("confirmTransaction", () => {
    it("confirms a matched transaction", async () => {
      const { service, bankTransactions } = buildService();
      const tx = baseTx({
        matchedVoucherId: VOUCHER_ID,
        matchStatus: "MATCHED",
        matchConfidence: 80,
      });
      bankTransactions.findById.mockResolvedValue(tx);
      bankTransactions.updateMatch.mockResolvedValue({
        ...tx,
        matchStatus: "CONFIRMED",
      });

      const result = await service.confirmTransaction(ORG_ID, TX_ID);

      expect(result.matchStatus).toBe("CONFIRMED");
      expect(bankTransactions.updateMatch).toHaveBeenCalledWith(TX_ID, ORG_ID, {
        status: "CONFIRMED",
        matchedVoucherId: VOUCHER_ID,
        matchConfidence: 80,
      });
    });

    it("throws when transaction is not matched", async () => {
      const { service, bankTransactions } = buildService();
      bankTransactions.findById.mockResolvedValue(baseTx());

      await expect(service.confirmTransaction(ORG_ID, TX_ID)).rejects.toThrow(/måste vara matchad/);
    });

    it("includes match note when provided", async () => {
      const { service, bankTransactions } = buildService();
      const tx = baseTx({ matchedVoucherId: VOUCHER_ID, matchStatus: "MATCHED" });
      bankTransactions.findById.mockResolvedValue(tx);
      bankTransactions.updateMatch.mockResolvedValue({ ...tx, matchStatus: "CONFIRMED" });

      await service.confirmTransaction(ORG_ID, TX_ID, "Manuellt bekräftad");

      expect(bankTransactions.updateMatch).toHaveBeenCalledWith(
        TX_ID,
        ORG_ID,
        expect.objectContaining({ matchNote: "Manuellt bekräftad" }),
      );
    });
  });

  describe("createVoucherFromTransaction", () => {
    it("creates a voucher and marks transaction as confirmed", async () => {
      const { service, bankTransactions, vouchers, fiscalYears } = buildService();
      bankTransactions.findById.mockResolvedValue(baseTx());
      fiscalYears.findByOrganization.mockResolvedValue([
        {
          id: "fy-1",
          organizationId: ORG_ID,
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31"),
          isClosed: false,
        },
      ]);
      const createdVoucher = baseVoucher({ number: 42 });
      vouchers.create.mockResolvedValue({ ok: true, value: createdVoucher });
      bankTransactions.updateMatch.mockResolvedValue({
        ...baseTx(),
        matchStatus: "CONFIRMED",
        matchedVoucherId: VOUCHER_ID,
      });

      const result = await service.createVoucherFromTransaction({
        organizationId: ORG_ID,
        transactionId: TX_ID,
        bankAccountNumber: "1930",
        counterAccountNumber: "4010",
      });

      expect(result.voucher.id).toBe(VOUCHER_ID);
      expect(result.transaction.matchStatus).toBe("CONFIRMED");
      expect(vouchers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
          fiscalYearId: "fy-1",
          lines: expect.arrayContaining([
            expect.objectContaining({ debit: 15000, credit: 0 }),
            expect.objectContaining({ debit: 0, credit: 15000 }),
          ]),
        }),
      );
    });

    it("uses outgoing account order for negative amounts", async () => {
      const { service, bankTransactions, vouchers, fiscalYears } = buildService();
      bankTransactions.findById.mockResolvedValue(baseTx({ amountOre: -5000 }));
      fiscalYears.findByOrganization.mockResolvedValue([
        {
          id: "fy-1",
          organizationId: ORG_ID,
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31"),
          isClosed: false,
        },
      ]);
      vouchers.create.mockResolvedValue({ ok: true, value: baseVoucher() });
      bankTransactions.updateMatch.mockResolvedValue(baseTx());

      await service.createVoucherFromTransaction({
        organizationId: ORG_ID,
        transactionId: TX_ID,
        bankAccountNumber: "1930",
        counterAccountNumber: "6071",
      });

      // For outgoing (negative): counter account gets debit, bank account gets credit
      expect(vouchers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [
            expect.objectContaining({ accountNumber: "6071", debit: 5000, credit: 0 }),
            expect.objectContaining({ accountNumber: "1930", debit: 0, credit: 5000 }),
          ],
        }),
      );
    });

    it("uses incoming account order for positive amounts", async () => {
      const { service, bankTransactions, vouchers, fiscalYears } = buildService();
      bankTransactions.findById.mockResolvedValue(baseTx({ amountOre: 8000 }));
      fiscalYears.findByOrganization.mockResolvedValue([
        {
          id: "fy-1",
          organizationId: ORG_ID,
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31"),
          isClosed: false,
        },
      ]);
      vouchers.create.mockResolvedValue({ ok: true, value: baseVoucher() });
      bankTransactions.updateMatch.mockResolvedValue(baseTx());

      await service.createVoucherFromTransaction({
        organizationId: ORG_ID,
        transactionId: TX_ID,
        bankAccountNumber: "1930",
        counterAccountNumber: "3010",
      });

      // For incoming (positive): bank account gets debit, counter account gets credit
      expect(vouchers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [
            expect.objectContaining({ accountNumber: "1930", debit: 8000, credit: 0 }),
            expect.objectContaining({ accountNumber: "3010", debit: 0, credit: 8000 }),
          ],
        }),
      );
    });

    it("throws conflict when transaction already matched", async () => {
      const { service, bankTransactions } = buildService();
      bankTransactions.findById.mockResolvedValue(baseTx({ matchedVoucherId: "existing-voucher" }));

      await expect(
        service.createVoucherFromTransaction({
          organizationId: ORG_ID,
          transactionId: TX_ID,
          bankAccountNumber: "1930",
          counterAccountNumber: "4010",
        }),
      ).rejects.toThrow(/redan matchad/);
    });

    it("throws when transaction has zero amount", async () => {
      const { service, bankTransactions, fiscalYears } = buildService();
      bankTransactions.findById.mockResolvedValue(baseTx({ amountOre: 0 }));
      fiscalYears.findByOrganization.mockResolvedValue([
        {
          id: "fy-1",
          organizationId: ORG_ID,
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31"),
          isClosed: false,
        },
      ]);

      await expect(
        service.createVoucherFromTransaction({
          organizationId: ORG_ID,
          transactionId: TX_ID,
          bankAccountNumber: "1930",
          counterAccountNumber: "4010",
        }),
      ).rejects.toThrow(/0-belopp/);
    });

    it("throws when no open fiscal year covers the transaction date", async () => {
      const { service, bankTransactions, fiscalYears } = buildService();
      bankTransactions.findById.mockResolvedValue(baseTx());
      fiscalYears.findByOrganization.mockResolvedValue([
        {
          id: "fy-1",
          organizationId: ORG_ID,
          startDate: new Date("2025-01-01"),
          endDate: new Date("2025-12-31"),
          isClosed: false,
        },
      ]);

      await expect(
        service.createVoucherFromTransaction({
          organizationId: ORG_ID,
          transactionId: TX_ID,
          bankAccountNumber: "1930",
          counterAccountNumber: "4010",
        }),
      ).rejects.toThrow(/räkenskapsår/);
    });

    it("uses explicit fiscalYearId when provided", async () => {
      const { service, bankTransactions, vouchers } = buildService();
      bankTransactions.findById.mockResolvedValue(baseTx());
      vouchers.create.mockResolvedValue({ ok: true, value: baseVoucher() });
      bankTransactions.updateMatch.mockResolvedValue(baseTx());

      await service.createVoucherFromTransaction({
        organizationId: ORG_ID,
        transactionId: TX_ID,
        fiscalYearId: "fy-explicit",
        bankAccountNumber: "1930",
        counterAccountNumber: "4010",
      });

      expect(vouchers.create).toHaveBeenCalledWith(
        expect.objectContaining({ fiscalYearId: "fy-explicit" }),
      );
    });

    it("propagates voucher creation errors", async () => {
      const { service, bankTransactions, vouchers, fiscalYears } = buildService();
      bankTransactions.findById.mockResolvedValue(baseTx());
      fiscalYears.findByOrganization.mockResolvedValue([
        {
          id: "fy-1",
          organizationId: ORG_ID,
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31"),
          isClosed: false,
        },
      ]);
      vouchers.create.mockResolvedValue({
        ok: false,
        error: { message: "Obalanserat", code: "UNBALANCED" },
      });

      await expect(
        service.createVoucherFromTransaction({
          organizationId: ORG_ID,
          transactionId: TX_ID,
          bankAccountNumber: "1930",
          counterAccountNumber: "4010",
        }),
      ).rejects.toThrow(/Obalanserat/);
    });
  });

  describe("bulkConfirmTransactions", () => {
    it("delegates to updateMatchMany with CONFIRMED status", async () => {
      const { service, bankTransactions } = buildService();
      bankTransactions.updateMatchMany.mockResolvedValue(3);

      const count = await service.bulkConfirmTransactions(ORG_ID, ["tx-1", "tx-2", "tx-3"]);

      expect(count).toBe(3);
      expect(bankTransactions.updateMatchMany).toHaveBeenCalledWith(
        ["tx-1", "tx-2", "tx-3"],
        ORG_ID,
        { status: "CONFIRMED" },
      );
    });

    it("returns 0 for empty array without calling repo", async () => {
      const { service, bankTransactions } = buildService();
      const count = await service.bulkConfirmTransactions(ORG_ID, []);
      expect(count).toBe(0);
      expect(bankTransactions.updateMatchMany).not.toHaveBeenCalled();
    });
  });

  describe("bulkUnmatchTransactions", () => {
    it("delegates to updateMatchMany with PENDING_MATCH status and null fields", async () => {
      const { service, bankTransactions } = buildService();
      bankTransactions.updateMatchMany.mockResolvedValue(2);

      const count = await service.bulkUnmatchTransactions(ORG_ID, ["tx-1", "tx-2"]);

      expect(count).toBe(2);
      expect(bankTransactions.updateMatchMany).toHaveBeenCalledWith(["tx-1", "tx-2"], ORG_ID, {
        status: "PENDING_MATCH",
        matchedVoucherId: null,
        matchConfidence: null,
        matchNote: null,
      });
    });

    it("returns 0 for empty array without calling repo", async () => {
      const { service, bankTransactions } = buildService();
      const count = await service.bulkUnmatchTransactions(ORG_ID, []);
      expect(count).toBe(0);
      expect(bankTransactions.updateMatchMany).not.toHaveBeenCalled();
    });
  });
});
