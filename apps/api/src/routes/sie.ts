import type { FastifyInstance } from "fastify";
import { toFiscalYear } from "@muninsbok/db";
import { parseSie, exportSie, getAccountTypeFromNumber } from "@muninsbok/core";

export async function sieRoutes(fastify: FastifyInstance) {
  const voucherRepo = fastify.repos.vouchers;
  const accountRepo = fastify.repos.accounts;

  // Export SIE4
  fastify.get<{
    Params: { orgId: string };
    Querystring: { fiscalYearId: string };
  }>("/:orgId/sie/export", async (request, reply) => {
    const { orgId } = request.params;
    const { fiscalYearId } = request.query;

    if (!fiscalYearId) {
      return reply.status(400).send({ error: "fiscalYearId is required" });
    }

    // Get organization, fiscal year, accounts, and vouchers
    const db = fastify.repos.prisma;
    const [org, fiscalYear, accounts, vouchers] = await Promise.all([
      db.organization.findUnique({ where: { id: orgId } }),
      db.fiscalYear.findFirst({ where: { id: fiscalYearId, organizationId: orgId } }),
      accountRepo.findByOrganization(orgId),
      voucherRepo.findByFiscalYear(fiscalYearId, orgId),
    ]);

    if (!org) {
      return reply.status(404).send({ error: "Organization not found" });
    }

    if (!fiscalYear) {
      return reply.status(404).send({ error: "Fiscal year not found" });
    }

    const sieContent = exportSie({
      companyName: org.name,
      orgNumber: org.orgNumber,
      programName: "Munins bok",
      programVersion: "0.1.0",
      fiscalYear: toFiscalYear(fiscalYear),
      accounts,
      vouchers,
    });

    // Return as SIE file
    reply.header("Content-Type", "text/plain; charset=cp437");
    reply.header(
      "Content-Disposition",
      `attachment; filename="${org.name.replace(/[^a-zA-Z0-9]/g, "_")}_${fiscalYear.startDate.getFullYear()}.se"`
    );

    return sieContent;
  });

  // Import SIE4
  fastify.post<{
    Params: { orgId: string };
    Querystring: { fiscalYearId: string };
  }>("/:orgId/sie/import", async (request, reply) => {
    const { orgId } = request.params;
    const { fiscalYearId } = request.query;

    if (!fiscalYearId) {
      return reply.status(400).send({ error: "fiscalYearId is required" });
    }

    // Get the raw body as string
    const content = request.body as string;

    if (!content || typeof content !== "string") {
      return reply.status(400).send({ error: "SIE file content is required" });
    }

    // Parse SIE file
    const parseResult = parseSie(content);

    if (!parseResult.ok) {
      return reply.status(400).send({
        error: "Failed to parse SIE file",
        details: parseResult.error,
      });
    }

    const sieFile = parseResult.value;

    // Get existing accounts for the organization
    const existingAccounts = await accountRepo.findByOrganization(orgId);
    const existingAccountNumbers = new Set(existingAccounts.map((a) => a.number));

    // Import accounts that don't exist
    const newAccounts = sieFile.accounts.filter(
      (a) => !existingAccountNumbers.has(a.number)
    );

    if (newAccounts.length > 0) {
      await accountRepo.createMany(
        orgId,
        newAccounts.map((a) => ({
          number: a.number,
          name: a.name,
          type: getAccountTypeFromNumber(a.number),
        }))
      );
    }

    // Import vouchers
    let importedCount = 0;
    let errorCount = 0;

    for (const sieVoucher of sieFile.vouchers) {
      // Convert SIE transactions to voucher lines
      const lines = sieVoucher.transactions.map((t) => ({
        accountNumber: t.accountNumber,
        debit: t.amount > 0 ? t.amount : 0,
        credit: t.amount < 0 ? -t.amount : 0,
        ...(t.description != null && { description: t.description }),
      }));

      const result = await voucherRepo.create({
        organizationId: orgId,
        fiscalYearId,
        date: sieVoucher.date,
        description: sieVoucher.description || `Import ${sieVoucher.series}${sieVoucher.number}`,
        lines,
      });

      if (result.ok) {
        importedCount++;
      } else {
        errorCount++;
      }
    }

    return {
      data: {
        companyName: sieFile.companyName,
        accountsImported: newAccounts.length,
        vouchersImported: importedCount,
        vouchersWithErrors: errorCount,
      },
    };
  });
}
