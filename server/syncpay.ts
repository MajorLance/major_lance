type SyncPayTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  expires_at?: string;
};

type SyncPayCashInResponse = {
  message?: string;
  pix_code: string;
  identifier: string;
};

let cachedToken: { value: string; expiresAt: number } | null = null;
let tokenRequest: Promise<string> | null = null;

function getBaseUrl() {
  const baseUrl = process.env.SYNCPAY_API_URL?.trim();
  if (!baseUrl) {
    throw new Error("SYNCPAY_API_URL não configurada");
  }
  return baseUrl.replace(/\/$/, "");
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "message" in body
      ? String((body as { message?: unknown }).message)
      : `SyncPay respondeu HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as T;
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  if (tokenRequest) return tokenRequest;

  tokenRequest = (async () => {
    const startedAt = Date.now();
    const clientId = process.env.SYNCPAY_CLIENT_ID?.trim();
    const clientSecret = process.env.SYNCPAY_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      throw new Error("SYNCPAY_CLIENT_ID e SYNCPAY_CLIENT_SECRET não configurados");
    }

    const response = await fetch(`${getBaseUrl()}/api/partner/v1/auth-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
    });
    const token = await parseResponse<SyncPayTokenResponse>(response);
    const ttl = Math.max(60, Number(token.expires_in ?? 3600));
    cachedToken = { value: token.access_token, expiresAt: Date.now() + ttl * 1000 };
    console.info(`[SyncPay] auth-token concluído em ${Date.now() - startedAt}ms`);
    return token.access_token;
  })();

  try {
    return await tokenRequest;
  } finally {
    tokenRequest = null;
  }
}

export async function validateSyncPayCredentials() {
  await getAccessToken();
  return true;
}

export async function createSyncPayCashIn(input: {
  amount: number;
  description: string;
  webhookUrl?: string;
}) {
  const startedAt = Date.now();
  const token = await getAccessToken();
  const webhookUrl = input.webhookUrl?.trim() || process.env.SYNCPAY_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    throw new Error("SYNCPAY_WEBHOOK_URL não configurada");
  }

  const body: Record<string, unknown> = {
    amount: Number(input.amount.toFixed(2)),
    description: input.description,
  };

  body.webhook_url = webhookUrl;

  const response = await fetch(`${getBaseUrl()}/api/partner/v1/cash-in`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result = await parseResponse<SyncPayCashInResponse>(response);
  console.info(`[SyncPay] cash-in concluído em ${Date.now() - startedAt}ms`);
  return result;
}

export async function getSyncPayTransactionStatus(identifier: string) {
  const token = await getAccessToken();
  const response = await fetch(`${getBaseUrl()}/api/partner/v1/transaction/${encodeURIComponent(identifier)}`, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  return parseResponse<{ data?: { status?: string; amount?: number } }>(response);
}

export function resetSyncPayTokenForTests() {
  cachedToken = null;
  tokenRequest = null;
}
