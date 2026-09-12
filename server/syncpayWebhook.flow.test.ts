import { afterEach, describe, expect, it } from "vitest";
import { bids, pixCharges } from "../drizzle/schema";
import { applySyncPayWebhook, setDbForTests } from "./db";

function createFakeDb(existingBids: unknown[] = []) {
  const updates: unknown[] = [];
  const inserts: unknown[] = [];
  const charge = {
    id: 7,
    identifier: "syncpay-charge-7",
    requestKey: "request-7",
    userId: 3,
    roundId: "round-7",
    amount: "148.00",
    pixCode: "000201...",
    status: "pending" as const,
    providerPayload: null,
    paidAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const fakeDb = {
    select() {
      return {
        from(table: unknown) {
          return {
            where() {
              return {
                limit: async () => table === pixCharges ? [charge] : existingBids,
              };
            },
          };
        },
      };
    },
    update() {
      return {
        set(values: unknown) {
          return {
            where: async () => { updates.push(values); },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(values: unknown) {
          return {
            onDuplicateKeyUpdate: async () => {
              if (table === bids) {
                inserts.push(values);
                existingBids.push(values);
              }
            },
          };
        },
      };
    },
  } as never;

  return { fakeDb, updates, inserts };
}

afterEach(() => setDbForTests(null));

describe("applySyncPayWebhook", () => {
  it("mantém a cobrança pendente sem criar lance", async () => {
    const { fakeDb, inserts } = createFakeDb();
    setDbForTests(fakeDb);

    const result = await applySyncPayWebhook({
      identifier: "syncpay-charge-7",
      status: "pending",
      amount: 148,
      payload: { id: "syncpay-charge-7", status: "pending" },
    });

    expect(result?.status).toBe("pending");
    expect(inserts).toHaveLength(0);
  });

  it("cria exatamente um lance quando o pagamento é confirmado, mesmo com webhook repetido", async () => {
    const { fakeDb, inserts } = createFakeDb();
    setDbForTests(fakeDb);
    const webhook = {
      identifier: "syncpay-charge-7",
      status: "paid" as const,
      amount: 148,
      payload: { id: "syncpay-charge-7", status: "completed", amount: 148 },
    };

    await applySyncPayWebhook(webhook);
    await applySyncPayWebhook(webhook);

    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ pixChargeId: 7, userId: 3, amount: "148.00" });
  });
});
