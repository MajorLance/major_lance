import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import {
  BYPASS_PAYMENT_CONFIRMATION_MAX_MS,
  BYPASS_PAYMENT_CONFIRMATION_MIN_MS,
  DEVELOPMENT_AUTO_BIDS_PER_ROUND,
  DEVELOPMENT_BID_SCHEDULE_MS,
  getDevelopmentBidDelayMs,
  PRIZE_SEQUENCE,
  ROUND_DURATION_MS,
  buildDevelopmentRoundSeed,
  getDevelopmentBidBand,
  getNextDevelopmentBidAmount,
  getPaymentBypassConfirmationDelayMs,
  isCurrentRound,
  mergeAuctionBids,
  nextSequenceIndex,
  shouldConfirmPaymentBypass,
  shouldCreateBidForPix,
} from "./db";
import type { TrpcContext } from "./_core/context";

describe("auction rules", () => {
  it("keeps the round duration at five minutes", () => {
    expect(ROUND_DURATION_MS).toBe(5 * 60 * 1000);
  });

  it("cycles prizes in the requested order", () => {
    expect(PRIZE_SEQUENCE).toEqual([3000, 5000, 1000]);
    expect(nextSequenceIndex(0)).toBe(1);
    expect(nextSequenceIndex(1)).toBe(2);
    expect(nextSequenceIndex(2)).toBe(0);
  });

  it("sets development bid bands by bid position", () => {
    expect(getDevelopmentBidBand(0)).toEqual({ min: 1, max: 10 });
    expect(getDevelopmentBidBand(1)).toEqual({ min: 11, max: 20 });
    expect(getDevelopmentBidBand(2)).toEqual({ min: 21, max: 30 });
    expect(getDevelopmentBidBand(3)).toEqual({ min: 1, max: 10 });
  });

  it("builds three deterministic randomized development seed bids by position", () => {
    const seed = buildDevelopmentRoundSeed("round-1024-0", 2);

    expect(DEVELOPMENT_AUTO_BIDS_PER_ROUND).toBe(3);
    expect(seed).toHaveLength(3);
    expect(seed.map((item) => item.amount)).toEqual([2, 17, 22]);
    expect(seed[0].amount).toBeGreaterThanOrEqual(1);
    expect(seed[0].amount).toBeLessThanOrEqual(10);
    expect(seed[1].amount).toBeGreaterThanOrEqual(11);
    expect(seed[1].amount).toBeLessThanOrEqual(20);
    expect(seed[2].amount).toBeGreaterThanOrEqual(21);
    expect(seed[2].amount).toBeLessThanOrEqual(30);
    expect(new Set(seed.map((item) => item.name)).size).toBe(seed.length);
    expect(seed.every((item) => item.name.length > 0)).toBe(true);
    expect(seed.every((item) => !item.name.includes("#"))).toBe(true);
  });

  it("schedules development bids at 5, 18 and 32 seconds of the round", () => {
    const startsAt = new Date("2026-09-12T12:00:00.000Z");

    expect(DEVELOPMENT_BID_SCHEDULE_MS).toEqual([
      5 * 1000,
      18 * 1000,
      32 * 1000,
    ]);
    expect(getDevelopmentBidDelayMs(startsAt, 0, startsAt)).toBe(5 * 1000);
    expect(
      getDevelopmentBidDelayMs(
        startsAt,
        1,
        new Date(startsAt.getTime() + 10 * 1000),
      ),
    ).toBe(8 * 1000);
    expect(
      getDevelopmentBidDelayMs(
        startsAt,
        2,
        new Date(startsAt.getTime() + 32 * 1000),
      ),
    ).toBe(0);
  });

  it("rejects a payment request when the client is on an old round", () => {
    expect(isCurrentRound("round-old", "round-active")).toBe(false);
    expect(isCurrentRound("round-active", "round-active")).toBe(true);
  });

  it("combines paid and manual bids in descending amount order", () => {
    const now = new Date("2026-09-02T18:00:00.000Z");
    const result = mergeAuctionBids(
      [
        {
          id: 1,
          name: "Ana",
          amount: "300.00",
          createdAt: now,
        },
      ],
      [
        {
          id: 2,
          name: "Bruno",
          amount: "450.00",
          createdAt: new Date(now.getTime() - 1000),
        },
      ],
    );
    expect(result.map((bid) => [bid.name, bid.amount, bid.source])).toEqual([
      ["Bruno", 450, "manual"],
      ["Ana", 300, "pix"],
    ]);
  });

  it("keeps the planned development bid when it can beat the current bid", () => {
    expect(getNextDevelopmentBidAmount(21, 20)).toBe(21);
  });

  it("covers the current bid when the planned development bid is not enough", () => {
    expect(getNextDevelopmentBidAmount(20, 20)).toBe(21);
    expect(getNextDevelopmentBidAmount(20, 25)).toBe(26);
  });

  it("creates a public bid only after a confirmed payment", () => {
    expect(shouldCreateBidForPix("pending", false)).toBe(false);
    expect(shouldCreateBidForPix("paid", false)).toBe(true);
    expect(shouldCreateBidForPix("paid", true)).toBe(false);
  });

  it("keeps bypass payment confirmation between 10 and 20 seconds", () => {
    const key = "round-test-request-key";
    const delay = getPaymentBypassConfirmationDelayMs(key);
    const createdAt = new Date("2026-09-12T12:00:00.000Z");

    expect(delay).toBeGreaterThanOrEqual(BYPASS_PAYMENT_CONFIRMATION_MIN_MS);
    expect(delay).toBeLessThanOrEqual(BYPASS_PAYMENT_CONFIRMATION_MAX_MS);
    expect(
      shouldConfirmPaymentBypass({
        createdAt,
        key,
        now: new Date(createdAt.getTime() + delay - 1),
      }),
    ).toBe(false);
    expect(
      shouldConfirmPaymentBypass({
        createdAt,
        key,
        now: new Date(createdAt.getTime() + delay),
      }),
    ).toBe(true);
  });

  it("blocks manual bid insertion for unauthenticated callers", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };

    await expect(
      appRouter.createCaller(ctx).admin.createManualBid({
        roundId: "round-test",
        name: "Participante",
        amount: 250,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks manual bid insertion for authenticated non-admin users", async () => {
    const now = new Date("2026-09-03T12:00:00.000Z");
    const ctx: TrpcContext = {
      user: {
        id: 2,
        openId: "regular-user",
        email: "user@example.com",
        name: "Usuário comum",
        loginMethod: "manus",
        role: "user",
        createdAt: now,
        updatedAt: now,
        lastSignedIn: now,
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };

    await expect(
      appRouter.createCaller(ctx).admin.createManualBid({
        roundId: "round-test",
        name: "Participante",
        amount: 250,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
