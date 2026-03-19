import {
  type AdapterAuthCodeExchangeInput,
  type AdapterAuthInitInput,
  type AdapterAuthInitResult,
  type AdapterFetchTransactionsInput,
  type AdapterFetchTransactionsResult,
  type AdapterTokenSet,
  type IAggregatorBankAdapter,
  BankAdapterError,
} from "./bank-adapter.js";

function base64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function token(prefix: string, seed: string): string {
  const now = Date.now().toString(36);
  return `${prefix}_${base64Url(seed)}_${now}`;
}

function parseDateCursor(cursor: string | undefined): Date | null {
  if (!cursor) return null;
  const asDate = new Date(cursor);
  return Number.isNaN(asDate.getTime()) ? null : asDate;
}

function buildSyntheticTransactions(
  input: AdapterFetchTransactionsInput,
  provider: string,
): AdapterFetchTransactionsResult {
  const pageSize = Math.min(Math.max(input.pageSize ?? 50, 1), 200);
  const fromDate = input.fromDate ?? new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const toDate = input.toDate ?? new Date();
  const cursorDate = parseDateCursor(input.cursor);
  const startDate = cursorDate ?? fromDate;

  const transactions = [] as AdapterFetchTransactionsResult["transactions"];

  for (let i = 0; i < pageSize; i++) {
    const bookedAt = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    if (bookedAt > toDate) break;

    const amountOre = i % 3 === 0 ? 129900 : -Math.round((350 + i * 17.5) * 100);
    const extId = `${provider}-${input.externalConnectionId}-${bookedAt.toISOString().slice(0, 10)}-${i}`;

    transactions.push({
      externalTransactionId: extId,
      bookedAt,
      valueDate: bookedAt,
      description: amountOre > 0 ? "Inbetalning" : "Kortköp",
      amountOre,
      currency: "SEK",
      reference: `REF-${bookedAt.getTime()}`,
      counterpartyName: amountOre > 0 ? "Kundinbetalning" : "Leverantör",
      rawData: {
        source: "sandbox",
        provider,
      },
    });
  }

  const last = transactions.at(-1);
  return {
    transactions,
    ...(last != null && { nextCursor: last.bookedAt.toISOString() }),
  };
}

export class SandboxAggregatorBankAdapter implements IAggregatorBankAdapter {
  readonly provider: string;
  private readonly authorizeBaseUrl: string;

  constructor(options?: { provider?: string; authorizeBaseUrl?: string }) {
    this.provider = options?.provider ?? "sandbox";
    this.authorizeBaseUrl =
      options?.authorizeBaseUrl ?? "https://sandbox.aggregator.local/oauth/authorize";
  }

  async createAuthorizationUrl(input: AdapterAuthInitInput): Promise<AdapterAuthInitResult> {
    if (!input.redirectUri) {
      throw new BankAdapterError("ADAPTER_INVALID_REQUEST", "redirectUri krävs");
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const params = new URLSearchParams({
      client_id: "muninsbok-sandbox",
      response_type: "code",
      scope: "accounts transactions",
      redirect_uri: input.redirectUri,
      state: input.state,
      connection_id: input.connectionExternalId,
      org: input.organizationId,
    });

    return {
      authorizationUrl: `${this.authorizeBaseUrl}?${params.toString()}`,
      state: input.state,
      expiresAt,
    };
  }

  async exchangeAuthorizationCode(input: AdapterAuthCodeExchangeInput): Promise<AdapterTokenSet> {
    if (!input.code.startsWith("sandbox-code-")) {
      throw new BankAdapterError("ADAPTER_INVALID_REQUEST", "Ogiltig sandbox authorization code");
    }

    if (!input.redirectUri) {
      throw new BankAdapterError("ADAPTER_INVALID_REQUEST", "redirectUri krävs vid token exchange");
    }

    return {
      accessToken: token("sbx_at", input.code),
      refreshToken: token("sbx_rt", input.code),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      tokenType: "Bearer",
      scope: ["accounts", "transactions"],
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<AdapterTokenSet> {
    if (!refreshToken.startsWith("sbx_rt_")) {
      throw new BankAdapterError("ADAPTER_UNAUTHORIZED", "Ogiltig refresh token");
    }

    return {
      accessToken: token("sbx_at", refreshToken),
      refreshToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      tokenType: "Bearer",
      scope: ["accounts", "transactions"],
    };
  }

  async fetchTransactions(
    input: AdapterFetchTransactionsInput,
  ): Promise<AdapterFetchTransactionsResult> {
    if (!input.accessToken.startsWith("sbx_at_")) {
      throw new BankAdapterError("ADAPTER_UNAUTHORIZED", "Ogiltig access token");
    }

    if (!input.externalConnectionId) {
      throw new BankAdapterError("ADAPTER_INVALID_REQUEST", "externalConnectionId krävs");
    }

    return buildSyntheticTransactions(input, this.provider);
  }
}

export function createBankAdapterFromEnv(): IAggregatorBankAdapter {
  const provider = process.env["BANK_ADAPTER_PROVIDER"] ?? "sandbox";

  if (provider !== "sandbox") {
    throw new BankAdapterError(
      "ADAPTER_INVALID_REQUEST",
      `Okänd bankadapter-provider: ${provider}. Endast sandbox stöds i Sprint 2.`,
    );
  }

  return new SandboxAggregatorBankAdapter({ provider });
}
