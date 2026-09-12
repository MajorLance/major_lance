import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizePixStatus, shouldCreateBidForPix } from "./db";
import { createSyncPayCashIn, getSyncPayTransactionStatus, resetSyncPayTokenForTests } from "./syncpay";
import { isAuthorizedWebhook } from "./syncpayWebhook";

const originalEnv = {
  apiUrl: process.env.SYNCPAY_API_URL,
  clientId: process.env.SYNCPAY_CLIENT_ID,
  clientSecret: process.env.SYNCPAY_CLIENT_SECRET,
  webhookUrl: process.env.SYNCPAY_WEBHOOK_URL,
  webhookSecret: process.env.SYNCPAY_WEBHOOK_SECRET,
};

afterEach(() => {
  vi.restoreAllMocks();
  resetSyncPayTokenForTests();
  process.env.SYNCPAY_API_URL = originalEnv.apiUrl;
  process.env.SYNCPAY_CLIENT_ID = originalEnv.clientId;
  process.env.SYNCPAY_CLIENT_SECRET = originalEnv.clientSecret;
  process.env.SYNCPAY_WEBHOOK_URL = originalEnv.webhookUrl;
  process.env.SYNCPAY_WEBHOOK_SECRET = originalEnv.webhookSecret;
});

describe("SyncPay Pix", () => {
  it.each([
    ["paid", "paid"],
    ["completed", "paid"],
    ["approved", "paid"],
    ["pending", "pending"],
    ["waiting", "pending"],
    ["expired", "expired"],
    ["cancelled", "expired"],
    ["refused", "failed"],
  ])("normaliza %s para %s", (input, expected) => {
    expect(normalizePixStatus(input)).toBe(expected);
  });

  it("rejeita status desconhecido para não registrar lance indevido", () => {
    expect(normalizePixStatus("unknown-status")).toBeNull();
  });

  it("só permite criar o lance quando a cobrança está paga e ainda não há lance", () => {
    expect(shouldCreateBidForPix("pending", false)).toBe(false);
    expect(shouldCreateBidForPix("expired", false)).toBe(false);
    expect(shouldCreateBidForPix("paid", false)).toBe(true);
    expect(shouldCreateBidForPix("paid", true)).toBe(false);
    expect(shouldCreateBidForPix("paid", true)).toBe(false);
  });

  it("envia o valor em reais e o callback configurado no Cash-in", async () => {
    process.env.SYNCPAY_API_URL = "https://api.syncpayments.com.br";
    process.env.SYNCPAY_CLIENT_ID = "client-id";
    process.env.SYNCPAY_CLIENT_SECRET = "client-secret";
    process.env.SYNCPAY_WEBHOOK_URL = "https://major-lance.example/api/syncpay/webhook";

    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ pix_code: "000201...", identifier: "charge-123" }), { status: 200 }));

    const result = await createSyncPayCashIn({ amount: 147.5, description: "Lance rodada-01" });
    const requestBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));

    expect(result.identifier).toBe("charge-123");
    expect(requestBody).toMatchObject({
      amount: 147.5,
      description: "Lance rodada-01",
      webhook_url: "https://major-lance.example/api/syncpay/webhook",
    });
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({ Authorization: "Bearer token" });
  });

  it("compartilha a autenticação entre Cash-ins concorrentes", async () => {
    process.env.SYNCPAY_API_URL = "https://api.syncpayments.com.br";
    process.env.SYNCPAY_CLIENT_ID = "client-id";
    process.env.SYNCPAY_CLIENT_SECRET = "client-secret";
    process.env.SYNCPAY_WEBHOOK_URL = "https://major-lance.example/api/syncpay/webhook";

    let authCalls = 0;
    let releaseAuth!: () => void;
    const authGate = new Promise<void>(resolve => { releaseAuth = resolve; });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      if (String(input).includes("auth-token")) {
        authCalls += 1;
        await authGate;
        return new Response(JSON.stringify({ access_token: "shared-token", expires_in: 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ pix_code: "000201...", identifier: `charge-${authCalls}` }), { status: 200 });
    });

    const first = createSyncPayCashIn({ amount: 148, description: "Lance 1" });
    const second = createSyncPayCashIn({ amount: 149, description: "Lance 2" });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(authCalls).toBe(1);
    releaseAuth();
    await Promise.all([first, second]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("consulta o status da transação pelo identifier", async () => {
    process.env.SYNCPAY_API_URL = "https://api.syncpayments.com.br";
    process.env.SYNCPAY_CLIENT_ID = "client-id";
    process.env.SYNCPAY_CLIENT_SECRET = "client-secret";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { status: "completed", amount: 1 } }), { status: 200 }));

    const result = await getSyncPayTransactionStatus("charge-123");
    expect(result.data?.status).toBe("completed");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.syncpayments.com.br/api/partner/v1/transaction/charge-123");
  });

  it("valida o segredo Bearer do webhook", () => {
    process.env.SYNCPAY_WEBHOOK_SECRET = "webhook-secret";
    const makeRequest = (authorization?: string) => ({
      header: (name: string) => name === "authorization" ? authorization : undefined,
    }) as never;

    expect(isAuthorizedWebhook(makeRequest("Bearer webhook-secret"))).toBe(true);
    expect(isAuthorizedWebhook(makeRequest("Bearer wrong-secret"))).toBe(false);
    expect(isAuthorizedWebhook(makeRequest())).toBe(false);
  });

  it("aceita o Bearer gerado pelo painel do SyncPay quando nenhum segredo local foi configurado", () => {
    delete process.env.SYNCPAY_WEBHOOK_SECRET;
    const makeRequest = () => ({ header: () => "Bearer syncpay-webhook-token" }) as never;
    expect(isAuthorizedWebhook(makeRequest())).toBe(true);
  });
});
