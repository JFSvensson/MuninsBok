import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../client.js";
import { VoucherRepository } from "./voucher.repository.js";

const integrationTestsEnabled = process.env["RUN_DB_INTEGRATION_TESTS"] === "true";

describe.skipIf(!integrationTestsEnabled)("VoucherRepository PostgreSQL integration", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("allocates distinct consecutive numbers for concurrent voucher creation", async () => {
    const organization = await prisma.organization.create({
      data: {
        orgNumber: `integration-${randomUUID()}`,
        name: "Voucher concurrency integration test",
      },
    });

    try {
      const fiscalYear = await prisma.fiscalYear.create({
        data: {
          organizationId: organization.id,
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: new Date("2026-12-31T23:59:59.999Z"),
        },
      });

      await prisma.account.createMany({
        data: [
          { organizationId: organization.id, number: "1930", name: "Företagskonto", type: "ASSET" },
          { organizationId: organization.id, number: "1910", name: "Kassa", type: "ASSET" },
        ],
      });

      const concurrentCount = 12;
      const repository = new VoucherRepository(prisma);
      const results = await Promise.all(
        Array.from({ length: concurrentCount }, (_unused, index) =>
          repository.create({
            organizationId: organization.id,
            fiscalYearId: fiscalYear.id,
            date: new Date("2026-06-15T00:00:00.000Z"),
            description: `Concurrent voucher ${index + 1}`,
            lines: [
              { accountNumber: "1930", debit: index + 1, credit: 0 },
              { accountNumber: "1910", debit: 0, credit: index + 1 },
            ],
          }),
        ),
      );

      expect(results.every((result) => result.ok)).toBe(true);
      const numbers = results.flatMap((result) => (result.ok ? [result.value.number] : []));
      expect(numbers.sort((left, right) => left - right)).toEqual(
        Array.from({ length: concurrentCount }, (_unused, index) => index + 1),
      );
    } finally {
      await prisma.organization.delete({ where: { id: organization.id } });
    }
  });
});
