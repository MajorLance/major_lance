import { describe, expect, it } from "vitest";
import { isSyntheticSyncPayTestPayload } from "./syncpayWebhook";

describe("SyncPay synthetic webhook test", () => {
  it("reconhece apenas a mensagem fixa do teste", () => {
    expect(isSyntheticSyncPayTestPayload({ message: "This is a test webhook payload." })).toBe(true);
    expect(isSyntheticSyncPayTestPayload({ data: { message: "This is a test webhook payload." } })).toBe(true);
    expect(isSyntheticSyncPayTestPayload({ message: "This is a test webhook payload.", id: "real-id" })).toBe(false);
    expect(isSyntheticSyncPayTestPayload({ message: "This is a test webhook payload.", data: { status: "completed" } })).toBe(false);
    expect(isSyntheticSyncPayTestPayload({ message: "paid", id: "real-id", status: "completed" })).toBe(false);
    expect(isSyntheticSyncPayTestPayload({})).toBe(false);
  });
});
