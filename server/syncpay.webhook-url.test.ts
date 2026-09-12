import { afterEach, describe, expect, it, vi } from "vitest";
import { createSyncPayCashIn, resetSyncPayTokenForTests } from "./syncpay";

afterEach(() => {
  vi.restoreAllMocks();
  resetSyncPayTokenForTests();
});

describe("SyncPay webhook URL", () => {
  it("sends the current public callback in the Cash-in request", async () => {
    process.env.SYNCPAY_API_URL = "https://api.syncpayments.com.br";
    process.env.SYNCPAY_CLIENT_ID = "test-client";
    process.env.SYNCPAY_CLIENT_SECRET = "test-secret";
    process.env.SYNCPAY_WEBHOOK_URL = "https://majorlance-eovksagm.manus.space/api/syncpay/webhook";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ pix_code: "000201...", identifier: "charge-url-test" }), { status: 200 }));

    await createSyncPayCashIn({ amount: 1, description: "Teste de callback" });
    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(body.webhook_url).toBe("https://majorlance-eovksagm.manus.space/api/syncpay/webhook");
  });
});
