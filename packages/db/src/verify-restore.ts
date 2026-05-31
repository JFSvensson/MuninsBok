import { Client } from "pg";

type Severity = "error" | "warning";

type CheckResult = {
  name: string;
  severity: Severity;
  violations: number;
  details: string;
};

function parseArgs(argv: string[]): { databaseUrl?: string } {
  const result: { databaseUrl?: string } = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--database-url") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("--database-url requires a value");
      }
      result.databaseUrl = value;
      i += 1;
    }
  }

  return result;
}

function formatResult(result: CheckResult): string {
  const status = result.violations === 0 ? "PASS" : result.severity === "error" ? "FAIL" : "WARN";
  return `[${status}] ${result.name}: ${result.details} (violations=${result.violations})`;
}

async function scalarCount(client: Client, query: string): Promise<number> {
  const response = await client.query<{ count: string | number }>(query);
  const raw = response.rows[0]?.count ?? 0;
  if (typeof raw === "number") {
    return raw;
  }
  return Number.parseInt(raw, 10);
}

async function tableExists(client: Client, tableName: string): Promise<boolean> {
  const response = await client.query<{ exists: string | null }>(
    "SELECT to_regclass($1) AS exists",
    [`public.${tableName}`],
  );
  return response.rows[0]?.exists !== null;
}

async function run(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const connectionString =
    args.databaseUrl ?? process.env["VERIFY_DATABASE_URL"] ?? process.env["DATABASE_URL"];

  if (!connectionString) {
    throw new Error("DATABASE_URL or VERIFY_DATABASE_URL is required (or pass --database-url)");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const results: CheckResult[] = [];

    const vouchersCount = await scalarCount(client, "SELECT COUNT(*) AS count FROM vouchers");
    const voucherLinesCount = await scalarCount(
      client,
      "SELECT COUNT(*) AS count FROM voucher_lines",
    );
    const accountingEventsTableExists = await tableExists(client, "accounting_events");
    const accountingEventsCount = accountingEventsTableExists
      ? await scalarCount(client, "SELECT COUNT(*) AS count FROM accounting_events")
      : 0;

    console.log("Restore verification snapshot:");
    console.log(`- vouchers: ${vouchersCount}`);
    console.log(`- voucher_lines: ${voucherLinesCount}`);
    if (accountingEventsTableExists) {
      console.log(`- accounting_events: ${accountingEventsCount}`);
    } else {
      console.log("- accounting_events: table missing (older schema)");
    }

    results.push({
      name: "Voucher lines must reference existing vouchers",
      severity: "error",
      violations: await scalarCount(
        client,
        `
          SELECT COUNT(*) AS count
          FROM voucher_lines line
          LEFT JOIN vouchers voucher ON voucher.id = line.voucher_id
          WHERE voucher.id IS NULL
        `,
      ),
      details: "orphan voucher_lines",
    });

    results.push({
      name: "Voucher lines must reference existing accounts",
      severity: "error",
      violations: await scalarCount(
        client,
        `
          SELECT COUNT(*) AS count
          FROM voucher_lines line
          LEFT JOIN accounts account ON account.id = line.account_id
          WHERE account.id IS NULL
        `,
      ),
      details: "orphan voucher_lines.account_id",
    });

    results.push({
      name: "Every voucher must have at least one line",
      severity: "error",
      violations: await scalarCount(
        client,
        `
          SELECT COUNT(*) AS count
          FROM vouchers voucher
          LEFT JOIN voucher_lines line ON line.voucher_id = voucher.id
          WHERE line.id IS NULL
        `,
      ),
      details: "vouchers without voucher_lines",
    });

    results.push({
      name: "Voucher lines must be single-sided and positive",
      severity: "error",
      violations: await scalarCount(
        client,
        `
          SELECT COUNT(*) AS count
          FROM voucher_lines
          WHERE debit < 0
             OR credit < 0
             OR (debit = 0 AND credit = 0)
             OR (debit > 0 AND credit > 0)
        `,
      ),
      details: "invalid debit/credit combinations",
    });

    results.push({
      name: "Each voucher must be balanced",
      severity: "error",
      violations: await scalarCount(
        client,
        `
          SELECT COUNT(*) AS count
          FROM (
            SELECT voucher_id
            FROM voucher_lines
            GROUP BY voucher_id
            HAVING COALESCE(SUM(debit), 0) <> COALESCE(SUM(credit), 0)
          ) unbalanced
        `,
      ),
      details: "vouchers where sum(debit) != sum(credit)",
    });

    results.push({
      name: "Approved vouchers must not have pending approval steps",
      severity: "warning",
      violations: await scalarCount(
        client,
        `
          SELECT COUNT(*) AS count
          FROM approval_steps step
          INNER JOIN vouchers voucher ON voucher.id = step.voucher_id
          WHERE voucher.status = 'APPROVED'
            AND step.status = 'PENDING'
        `,
      ),
      details: "APPROVED vouchers with PENDING approval_steps",
    });

    if (accountingEventsTableExists) {
      results.push({
        name: "Accounting events must reference existing organizations",
        severity: "error",
        violations: await scalarCount(
          client,
          `
            SELECT COUNT(*) AS count
            FROM accounting_events event
            LEFT JOIN organizations organization ON organization.id = event.organization_id
            WHERE organization.id IS NULL
          `,
        ),
        details: "orphan accounting_events.organization_id",
      });

      results.push({
        name: "Accounting events should exist when vouchers exist",
        severity: "warning",
        violations: vouchersCount > 0 && accountingEventsCount === 0 ? 1 : 0,
        details: "vouchers > 0 but accounting_events = 0",
      });
    }

    console.log("\nRestore verification results:");
    for (const result of results) {
      console.log(formatResult(result));
    }

    const errorViolations = results.filter(
      (result) => result.severity === "error" && result.violations > 0,
    );
    const warningViolations = results.filter(
      (result) => result.severity === "warning" && result.violations > 0,
    );

    console.log("\nRestore verification summary:");
    console.log(`- errors: ${errorViolations.length}`);
    console.log(`- warnings: ${warningViolations.length}`);

    if (errorViolations.length > 0) {
      console.error("Restore verification failed due to blocking integrity errors.");
      return 1;
    }

    console.log("Restore verification passed (no blocking integrity errors).\n");
    return 0;
  } finally {
    await client.end();
  }
}

run()
  .then((code) => {
    process.exit(code);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Restore verification failed: ${message}`);
    process.exit(1);
  });
