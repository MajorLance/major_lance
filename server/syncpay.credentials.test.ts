import { describe, expect, it } from "vitest";
import { validateSyncPayCredentials } from "./syncpay";

describe("SyncPay credentials", () => {
  it("mantém a integração inativa sem credenciais e não cria cobrança", async () => {
    if (!process.env.SYNCPAY_CLIENT_ID || !process.env.SYNCPAY_CLIENT_SECRET) {
      await expect(validateSyncPayCredentials()).rejects.toThrow("SYNCPAY_CLIENT_ID e SYNCPAY_CLIENT_SECRET não configurados");
      return;
    }

    await expect(validateSyncPayCredentials()).resolves.toBe(true);
  }, 15_000);
});
