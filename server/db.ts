import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  auctionRounds,
  bids,
  customerProfiles,
  manualBids,
  pixCharges,
  users,
  walletAccounts,
  walletTransactions,
  winners as winnerRecords,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export function setDbForTests(db: ReturnType<typeof drizzle> | null) {
  _db = db;
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0)
      updateSet.lastSignedIn = new Date();

    await db
      .insert(users)
      .values(values)
      .onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCustomerProfile(input: {
  fullName: string;
  whatsapp: string;
  pixKeyType: "cpf" | "cnpj" | "email" | "phone" | "random";
  pixKey: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não configurado");
  const result = await db.insert(customerProfiles).values({
    fullName: input.fullName.trim(),
    whatsapp: input.whatsapp.trim(),
    pixKeyType: input.pixKeyType,
    pixKey: input.pixKey.trim(),
  });
  const insertedId = Number(
    (result as unknown as [{ insertId?: number }, unknown])[0]?.insertId ?? 0,
  );
  const created = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.id, insertedId))
    .limit(1);
  if (!created[0]) throw new Error("Não foi possível salvar o cadastro");
  return created[0];
}

export async function getCustomerProfiles() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não configurado");
  return db
    .select()
    .from(customerProfiles)
    .orderBy(desc(customerProfiles.createdAt));
}

export async function getCustomerProfileById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não configurado");
  return (
    await db
      .select()
      .from(customerProfiles)
      .where(eq(customerProfiles.id, id))
      .limit(1)
  )[0];
}

export async function getWalletBalance(customerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não configurado");
  const account = (
    await db
      .select()
      .from(walletAccounts)
      .where(eq(walletAccounts.customerId, customerId))
      .limit(1)
  )[0];
  return { customerId, balance: Number(account?.balance ?? 0) };
}

export async function getWalletTransactions(customerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não configurado");
  return db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.customerId, customerId))
    .orderBy(desc(walletTransactions.createdAt));
}

export async function requestWalletWithdrawal(input: {
  customerId: number;
  amount: number;
  requestKey: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não configurado");
  const result = await db.transaction(async (tx) => {
    const existing = (
      await tx
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.idempotencyKey, input.requestKey))
        .limit(1)
    )[0];
    if (existing) return { alreadyProcessed: true };
    const debit = await tx
      .update(walletAccounts)
      .set({ balance: sql`balance - ${input.amount.toFixed(2)}` })
      .where(
        and(
          eq(walletAccounts.customerId, input.customerId),
          sql`balance >= ${input.amount.toFixed(2)}`,
        ),
      );
    const affectedRows = Number(
      (debit as unknown as [{ affectedRows?: number }, unknown])[0]
        ?.affectedRows ?? 0,
    );
    if (affectedRows !== 1)
      throw new Error("Saldo insuficiente para solicitar este saque");
    await tx.insert(walletTransactions).values({
      customerId: input.customerId,
      kind: "withdrawal",
      amount: (-input.amount).toFixed(2),
      idempotencyKey: input.requestKey,
      description: "Saque solicitado (processamento interno)",
    });
    return { alreadyProcessed: false };
  });
  return { ...result, ...(await getWalletBalance(input.customerId)) };
}

async function creditPrizeOnce(
  customerId: number,
  roundId: string,
  prize: number,
) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não configurado");
  await db
    .insert(walletAccounts)
    .values({ customerId, balance: "0.00" })
    .onDuplicateKeyUpdate({ set: { customerId: sql`customerId` } });
  const result = await db
    .insert(walletTransactions)
    .values({
      customerId,
      kind: "prize",
      amount: prize.toFixed(2),
      roundId,
      idempotencyKey: `prize:${roundId}`,
      description: `Prêmio da rodada ${prize.toFixed(2)}`,
    })
    .onDuplicateKeyUpdate({ set: { idempotencyKey: sql`idempotencyKey` } });
  const affectedRows = Number(
    (result as unknown as [{ affectedRows?: number }, unknown])[0]
      ?.affectedRows ?? 0,
  );
  if (affectedRows > 0) {
    await db
      .update(walletAccounts)
      .set({ balance: sql`balance + ${prize.toFixed(2)}` })
      .where(eq(walletAccounts.customerId, customerId));
  }
}

export function isPaymentBypassEnabled() {
  const raw = (
    process.env.BYPASS_PAYMENT_GATEWAY ??
    process.env.WALLET_BYPASS_GATEWAY ??
    process.env.PAYMENT_GATEWAY_BYPASS ??
    ""
  )
    .trim()
    .toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on")
    return true;
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off")
    return false;
  const hasSyncPayCredentials = Boolean(
    process.env.SYNCPAY_CLIENT_ID?.trim() &&
    process.env.SYNCPAY_CLIENT_SECRET?.trim(),
  );
  if (!hasSyncPayCredentials) return true;
  return false;
}

export function getPaymentBypassConfirmationDelayMs(key: string) {
  const range =
    BYPASS_PAYMENT_CONFIRMATION_MAX_MS - BYPASS_PAYMENT_CONFIRMATION_MIN_MS;
  return BYPASS_PAYMENT_CONFIRMATION_MIN_MS + (hashSeed(key) % (range + 1));
}

export function shouldConfirmPaymentBypass(input: {
  createdAt: Date;
  key: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return (
    now.getTime() - input.createdAt.getTime() >=
    getPaymentBypassConfirmationDelayMs(input.key)
  );
}

export async function creditWalletDepositBypass(input: {
  customerId: number;
  amount: number;
  requestKey: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não configurado");
  const idempotencyKey = `bypass-deposit:${input.requestKey}`;
  await db.transaction(async (tx) => {
    await tx
      .insert(walletAccounts)
      .values({ customerId: input.customerId, balance: "0.00" })
      .onDuplicateKeyUpdate({ set: { customerId: sql`customerId` } });
    const result = await tx
      .insert(walletTransactions)
      .values({
        customerId: input.customerId,
        kind: "prize",
        amount: input.amount.toFixed(2),
        idempotencyKey,
        description: `Depósito bypass R$ ${input.amount.toFixed(2)}`,
      })
      .onDuplicateKeyUpdate({ set: { idempotencyKey: sql`idempotencyKey` } });
    const affectedRows = Number(
      (result as unknown as [{ affectedRows?: number }, unknown])[0]
        ?.affectedRows ?? 0,
    );
    if (affectedRows > 0) {
      await tx
        .update(walletAccounts)
        .set({ balance: sql`balance + ${input.amount.toFixed(2)}` })
        .where(eq(walletAccounts.customerId, input.customerId));
    }
  });
}

async function settleFinishedRound(roundIdValue: string, prize: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não configurado");
  const winningBid = (await getRoundBids(roundIdValue))[0];
  if (!winningBid) return;
  const round = (
    await db
      .select()
      .from(auctionRounds)
      .where(eq(auctionRounds.id, roundIdValue))
      .limit(1)
  )[0];

  await db
    .insert(winnerRecords)
    .values({
      roundId: roundIdValue,
      name: winningBid.name,
      prize: prize.toFixed(2),
      winningBid: winningBid.amount.toFixed(2),
      wonAt: round?.endsAt ?? new Date(),
    })
    .onDuplicateKeyUpdate({ set: { roundId: sql`roundId` } });

  if (winningBid.ownerId) {
    await creditPrizeOnce(winningBid.ownerId, roundIdValue, prize);
  }
}

export async function reservePixChargeRequest(input: {
  requestKey: string;
  userId: number;
  roundId: string;
  amount: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não configurado");

  // A reserva acontece antes do request externo. A chave única faz retries
  // e cliques concorrentes reutilizarem a mesma intenção de cobrança.
  const insertResult = await db
    .insert(pixCharges)
    .values({
      identifier: input.requestKey,
      requestKey: input.requestKey,
      userId: input.userId,
      roundId: input.roundId,
      amount: input.amount.toFixed(2),
      pixCode: "",
      status: "pending",
    })
    .onDuplicateKeyUpdate({ set: { requestKey: sql`requestKey` } });

  const result = await db
    .select()
    .from(pixCharges)
    .where(
      and(
        eq(pixCharges.requestKey, input.requestKey),
        eq(pixCharges.userId, input.userId),
      ),
    )
    .limit(1);
  if (!result[0]) throw new Error("Reserva da cobrança Pix não foi persistida");
  const affectedRows = Number(
    (insertResult as unknown as [{ affectedRows?: number }, unknown])[0]
      ?.affectedRows ?? 0,
  );
  return { charge: result[0], isNew: affectedRows === 1 };
}

export async function completePixChargeRequest(input: {
  requestKey: string;
  identifier: string;
  pixCode: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não configurado");
  await db
    .update(pixCharges)
    .set({
      identifier: input.identifier,
      pixCode: input.pixCode,
      status: "pending",
    })
    .where(eq(pixCharges.requestKey, input.requestKey));

  const result = await db
    .select()
    .from(pixCharges)
    .where(eq(pixCharges.requestKey, input.requestKey))
    .limit(1);
  if (!result[0]) throw new Error("Cobrança Pix concluída não foi encontrada");
  return result[0];
}

export async function failPixChargeRequest(requestKey: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(pixCharges)
    .set({ status: "failed" })
    .where(eq(pixCharges.requestKey, requestKey));
}

export async function getPixChargeForUser(identifier: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não configurado");
  const result = await db
    .select()
    .from(pixCharges)
    .where(
      and(eq(pixCharges.identifier, identifier), eq(pixCharges.userId, userId)),
    )
    .limit(1);
  return result[0];
}

const paidStatuses = new Set([
  "paid",
  "completed",
  "approved",
  "confirmed",
  "success",
  "successful",
  "succeeded",
  "settled",
]);
const pendingStatuses = new Set(["pending", "waiting", "created"]);
const expiredStatuses = new Set(["expired", "cancelled", "canceled"]);

export function normalizePixStatus(
  value: unknown,
): "pending" | "paid" | "expired" | "failed" | null {
  const status = String(value ?? "")
    .toLowerCase()
    .trim();
  if (paidStatuses.has(status)) return "paid";
  if (pendingStatuses.has(status)) return "pending";
  if (expiredStatuses.has(status)) return "expired";
  if (status === "failed" || status === "failure" || status === "refused")
    return "failed";
  return null;
}

export function shouldCreateBidForPix(
  status: "pending" | "paid" | "expired" | "failed",
  bidAlreadyExists: boolean,
) {
  return status === "paid" && !bidAlreadyExists;
}

export const ROUND_DURATION_MS = 5 * 60 * 1000;
export const SETTLEMENT_DELAY_MS = 10 * 1000;
export const PRIZE_SEQUENCE = [3000, 5000, 1000] as const;
export const DEVELOPMENT_AUTO_BIDS_PER_ROUND = 3;
export const DEVELOPMENT_BID_SCHEDULE_MS = [
  5 * 1000,
  18 * 1000,
  32 * 1000,
] as const;
export const BYPASS_PAYMENT_CONFIRMATION_MIN_MS = 10 * 1000;
export const BYPASS_PAYMENT_CONFIRMATION_MAX_MS = 20 * 1000;

export type PublicAuctionBid = {
  id: string;
  name: string;
  amount: number;
  createdAt: Date;
  source: "pix" | "manual";
};

export function nextSequenceIndex(index: number) {
  return (index + 1) % PRIZE_SEQUENCE.length;
}

export function isCurrentRound(expectedRoundId: string, activeRoundId: string) {
  return expectedRoundId === activeRoundId;
}

type BidRecord = {
  id: number;
  name: string | null;
  amount: string | number;
  createdAt: Date;
  ownerId?: number | null;
};

const DEVELOPMENT_FIRST_NAMES = [
  "Ana",
  "Bruno",
  "Carla",
  "Diego",
  "Elisa",
  "Fabio",
  "Giulia",
  "Henrique",
  "Isabela",
  "Jorge",
  "Karen",
  "Lucas",
];
const DEVELOPMENT_LAST_NAMES = [
  "Alves",
  "Barros",
  "Costa",
  "Dias",
  "Esteves",
  "Freitas",
  "Gomes",
  "Henriques",
  "Ibrahim",
  "Lima",
  "Melo",
  "Nunes",
];
const developmentBidTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function mergeAuctionBids(
  paid: BidRecord[],
  manual: Array<{
    id: number;
    name: string;
    amount: string | number;
    createdAt: Date;
  }>,
) {
  return [
    ...paid.map((item) => ({
      id: `pix-${item.id}`,
      ownerId: item.ownerId ?? null,
      name: item.name ?? "Participante",
      amount: Number(item.amount),
      createdAt: item.createdAt,
      source: "pix" as const,
    })),
    ...manual.map((item) => ({
      id: `manual-${item.id}`,
      ownerId: null,
      name: item.name,
      amount: Number(item.amount),
      createdAt: item.createdAt,
      source: "manual" as const,
    })),
  ].sort(
    (a, b) =>
      b.amount - a.amount || b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

export function getNextDevelopmentBidAmount(
  plannedAmount: number,
  currentBid: number,
) {
  return plannedAmount > currentBid ? plannedAmount : currentBid + 1;
}

export function getDevelopmentBidDelayMs(
  startsAt: Date,
  position: number,
  now = new Date(),
) {
  const scheduledAt = DEVELOPMENT_BID_SCHEDULE_MS[position];
  if (scheduledAt === undefined) return null;
  return Math.max(0, scheduledAt - (now.getTime() - startsAt.getTime()));
}

function clearDevelopmentRoundTimer(roundId: string) {
  const existingTimer = developmentBidTimers.get(roundId);
  if (!existingTimer) return;
  clearTimeout(existingTimer);
  developmentBidTimers.delete(roundId);
}

function roundId(startsAt: Date, sequenceIndex: number) {
  return `round-${startsAt.getTime()}-${sequenceIndex}`;
}

function hashSeed(value: string) {
  let hash = 0;
  for (const char of value) {
    hash = Math.imul(31, hash) + char.charCodeAt(0);
    hash >>>= 0;
  }
  return hash;
}

function mixSeed(value: number) {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb352d);
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846ca68b);
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

export function getDevelopmentBidBand(position: number) {
  if (position === 1) return { min: 11, max: 20 };
  if (position === 2) return { min: 21, max: 30 };
  return { min: 1, max: 10 };
}

function getDevelopmentBidAmount(
  roundIdValue: string,
  sequenceIndex: number,
  position: number,
) {
  const { min, max } = getDevelopmentBidBand(position);
  const range = max - min + 1;
  const score = mixSeed(
    hashSeed(roundIdValue) ^
      Math.imul(position + 1, 0x9e3779b1) ^
      sequenceIndex,
  );
  return min + (score % range);
}

export function buildDevelopmentRoundSeed(
  roundIdValue: string,
  sequenceIndex: number,
) {
  const seed = hashSeed(roundIdValue);
  const totalEntries = DEVELOPMENT_AUTO_BIDS_PER_ROUND;
  const usedNames = new Set<string>();
  const seedBids: Array<{ name: string; amount: number }> = [];
  const maxNameCombinations =
    DEVELOPMENT_FIRST_NAMES.length * DEVELOPMENT_LAST_NAMES.length;

  for (let cursor = 0; seedBids.length < totalEntries; cursor += 1) {
    if (cursor >= maxNameCombinations) break;
    const first =
      DEVELOPMENT_FIRST_NAMES[(seed + cursor) % DEVELOPMENT_FIRST_NAMES.length];
    const last =
      DEVELOPMENT_LAST_NAMES[
        (seed * 7 + cursor * 5) % DEVELOPMENT_LAST_NAMES.length
      ];
    const name = `${first} ${last}`;
    if (usedNames.has(name)) continue;
    usedNames.add(name);
    seedBids.push({
      name,
      amount: getDevelopmentBidAmount(
        roundIdValue,
        sequenceIndex,
        seedBids.length,
      ),
    });
  }

  return seedBids;
}

async function insertDevelopmentRoundBid(
  roundId: string,
  sequenceIndex: number,
  position: number,
) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não configurado");

  const queue = buildDevelopmentRoundSeed(roundId, sequenceIndex);
  const entry = queue[position];
  if (!entry) return false;

  const allBids = await getRoundBids(roundId);
  const currentBid = allBids[0]?.amount ?? 0;
  const amount = getNextDevelopmentBidAmount(entry.amount, currentBid);
  const alreadyExists = allBids.some(
    (item) => Number(item.amount).toFixed(2) === amount.toFixed(2),
  );
  if (alreadyExists) return false;

  await db.insert(manualBids).values({
    roundId,
    name: entry.name,
    amount: amount.toFixed(2),
    createdByUserId: 0,
  });
  return true;
}

async function runDevelopmentRoundBid(
  roundId: string,
  sequenceIndex: number,
  position: number,
) {
  clearDevelopmentRoundTimer(roundId);

  const db = await getDb();
  if (!db) return;

  const round = (
    await db
      .select()
      .from(auctionRounds)
      .where(eq(auctionRounds.id, roundId))
      .limit(1)
  )[0];
  if (!round || round.status !== "active") return;

  const queue = buildDevelopmentRoundSeed(roundId, sequenceIndex);
  if (position >= queue.length) return;

  await insertDevelopmentRoundBid(roundId, sequenceIndex, position);

  if (position + 1 >= queue.length) return;
  const nextPosition = position + 1;
  const delay = getDevelopmentBidDelayMs(round.startsAt, nextPosition);
  if (delay === null) return;
  const timeout = setTimeout(() => {
    void runDevelopmentRoundBid(roundId, sequenceIndex, nextPosition);
  }, delay);
  developmentBidTimers.set(roundId, timeout);
}

async function seedDevelopmentRoundBids(round: {
  id: string;
  sequenceIndex: number;
  startsAt: Date;
  status: "active" | "finished" | "scheduled";
}) {
  if (round.status !== "active") return;

  const db = await getDb();
  if (!db) throw new Error("Banco de dados não configurado");

  const existing = await db
    .select()
    .from(manualBids)
    .where(eq(manualBids.roundId, round.id));
  const synthetic = existing
    .filter((item) => item.createdByUserId === 0)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const queue = buildDevelopmentRoundSeed(round.id, round.sequenceIndex);
  let syntheticCount = synthetic.length;

  for (; syntheticCount < queue.length; syntheticCount += 1) {
    const delay = getDevelopmentBidDelayMs(round.startsAt, syntheticCount);
    if (delay === null || delay > 0) break;
    const inserted = await insertDevelopmentRoundBid(
      round.id,
      round.sequenceIndex,
      syntheticCount,
    );
    if (!inserted) break;
  }

  if (syntheticCount >= queue.length) {
    clearDevelopmentRoundTimer(round.id);
    return;
  }

  if (developmentBidTimers.has(round.id)) return;

  const nextPosition = syntheticCount;
  const delay = getDevelopmentBidDelayMs(round.startsAt, nextPosition);
  if (delay === null) return;
  const timeout = setTimeout(() => {
    void runDevelopmentRoundBid(round.id, round.sequenceIndex, nextPosition);
  }, delay);
  developmentBidTimers.set(round.id, timeout);
}

export async function ensureCurrentRound(now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não configurado");

  const activeResult = await db
    .select()
    .from(auctionRounds)
    .where(eq(auctionRounds.status, "active"))
    .orderBy(desc(auctionRounds.startsAt))
    .limit(1);
  const active = activeResult[0];
  if (active && active.endsAt.getTime() > now.getTime()) {
    await seedDevelopmentRoundBids(active);
    return active;
  }

  if (!active) {
    const latestResult = await db
      .select()
      .from(auctionRounds)
      .orderBy(desc(auctionRounds.endsAt))
      .limit(1);
    const latest = latestResult[0];
    if (!latest) {
      const startsAt = now;
      const first = {
        id: roundId(startsAt, 0),
        sequenceIndex: 0,
        prize: PRIZE_SEQUENCE[0].toFixed(2),
        startsAt,
        endsAt: new Date(startsAt.getTime() + ROUND_DURATION_MS),
        status: "active" as const,
      };
      await db.insert(auctionRounds).values(first);
      const created = (
        await db
          .select()
          .from(auctionRounds)
          .where(eq(auctionRounds.id, first.id))
          .limit(1)
      )[0];
      if (created) await seedDevelopmentRoundBids(created);
      return created;
    }
    if (
      latest.status === "finished" &&
      now.getTime() < latest.endsAt.getTime() + SETTLEMENT_DELAY_MS
    )
      return latest;
    if (latest.endsAt.getTime() > now.getTime()) {
      await db
        .update(auctionRounds)
        .set({ status: "active" })
        .where(eq(auctionRounds.id, latest.id));
      const updated = { ...latest, status: "active" as const };
      await seedDevelopmentRoundBids(updated);
      return updated;
    }
  }

  const current =
    active ??
    (
      await db
        .select()
        .from(auctionRounds)
        .orderBy(desc(auctionRounds.endsAt))
        .limit(1)
    )[0];
  if (!current) throw new Error("Não foi possível determinar a rodada atual");
  if (current.status === "active") {
    await db
      .update(auctionRounds)
      .set({ status: "finished" })
      .where(eq(auctionRounds.id, current.id));
    await settleFinishedRound(current.id, Number(current.prize));
    if (now.getTime() < current.endsAt.getTime() + SETTLEMENT_DELAY_MS)
      return { ...current, status: "finished" as const };
  }

  let startsAt = new Date(current.endsAt.getTime() + SETTLEMENT_DELAY_MS);
  let sequenceIndex = nextSequenceIndex(current.sequenceIndex);
  let endsAt = new Date(startsAt.getTime() + ROUND_DURATION_MS);
  while (endsAt.getTime() <= now.getTime()) {
    const finishedId = roundId(startsAt, sequenceIndex);
    await db
      .insert(auctionRounds)
      .values({
        id: finishedId,
        sequenceIndex,
        prize: PRIZE_SEQUENCE[sequenceIndex].toFixed(2),
        startsAt,
        endsAt,
        status: "finished",
      })
      .onDuplicateKeyUpdate({ set: { status: "finished" } });
    await settleFinishedRound(finishedId, PRIZE_SEQUENCE[sequenceIndex]);
    startsAt = endsAt;
    sequenceIndex = nextSequenceIndex(sequenceIndex);
    endsAt = new Date(startsAt.getTime() + ROUND_DURATION_MS);
  }

  const nextId = roundId(startsAt, sequenceIndex);
  await db
    .insert(auctionRounds)
    .values({
      id: nextId,
      sequenceIndex,
      prize: PRIZE_SEQUENCE[sequenceIndex].toFixed(2),
      startsAt,
      endsAt,
      status: "active",
    })
    .onDuplicateKeyUpdate({ set: { status: "active" } });
  const created = (
    await db
      .select()
      .from(auctionRounds)
      .where(eq(auctionRounds.id, nextId))
      .limit(1)
  )[0];
  if (created) await seedDevelopmentRoundBids(created);
  return created;
}

async function getRoundBids(roundIdValue: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não configurado");
  const paid = await db
    .select({
      id: bids.id,
      ownerId: bids.userId,
      name: sql<
        string | null
      >`COALESCE(${users.name}, ${customerProfiles.fullName})`,
      amount: bids.amount,
      createdAt: bids.createdAt,
    })
    .from(bids)
    .leftJoin(users, eq(bids.userId, users.id))
    .leftJoin(customerProfiles, eq(bids.userId, customerProfiles.id))
    .where(eq(bids.roundId, roundIdValue));
  const manual = await db
    .select({
      id: manualBids.id,
      name: manualBids.name,
      amount: manualBids.amount,
      createdAt: manualBids.createdAt,
    })
    .from(manualBids)
    .where(eq(manualBids.roundId, roundIdValue));
  return mergeAuctionBids(paid, manual);
}

export async function getPublicAuctionState(now = new Date()) {
  const round = await ensureCurrentRound(now);
  if (!round) throw new Error("Rodada atual não encontrada");
  const allBids = await getRoundBids(round.id);
  const recentBids = [...allBids].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const leader = allBids[0] ?? null;

  const db = await getDb();
  if (!db) throw new Error("Banco de dados não configurado");

  const winners = (
    await db
      .select()
      .from(winnerRecords)
      .orderBy(desc(winnerRecords.wonAt))
      .limit(10)
  ).map((winner) => ({
    id: String(winner.id),
    roundId: winner.roundId,
    name: winner.name,
    amount: Number(winner.winningBid),
    bid: Number(winner.winningBid),
    prize: Number(winner.prize),
    wonAt: winner.wonAt,
  }));
  if (winners.length < 10) {
    const winnerRoundIds = new Set(winners.map((winner) => winner.roundId));
    const finishedRounds = await db
      .select()
      .from(auctionRounds)
      .where(eq(auctionRounds.status, "finished"))
      .orderBy(desc(auctionRounds.endsAt))
      .limit(10);
    for (const finished of finishedRounds) {
      if (winnerRoundIds.has(finished.id) || winners.length >= 10) continue;
      const winnerBids = await getRoundBids(finished.id);
      if (!winnerBids[0]) continue;
      winners.push({
        id: finished.id,
        roundId: finished.id,
        name: winnerBids[0].name,
        amount: winnerBids[0].amount,
        bid: winnerBids[0].amount,
        prize: Number(finished.prize),
        wonAt: finished.endsAt,
      });
    }
  }

  const nextIndex = nextSequenceIndex(round.sequenceIndex);
  const settling = round.status === "finished";
  return {
    currentRound: {
      id: round.id,
      prize: Number(round.prize),
      startsAt: round.startsAt,
      endsAt: round.endsAt,
      remainingSeconds: Math.max(
        0,
        Math.ceil((round.endsAt.getTime() - now.getTime()) / 1000),
      ),
      currentBid: leader?.amount ?? 0,
      leader: leader ? { id: leader.id, name: leader.name } : null,
    },
    recentBids,
    settlement: settling
      ? {
          winner: leader ? { name: leader.name, amount: leader.amount } : null,
          prize: Number(round.prize),
          remainingSeconds: Math.max(
            0,
            Math.ceil(
              (round.endsAt.getTime() + SETTLEMENT_DELAY_MS - now.getTime()) /
                1000,
            ),
          ),
        }
      : null,
    upcomingRound: settling
      ? null
      : {
          prize: PRIZE_SEQUENCE[nextIndex],
          startsAt: round.endsAt,
          sequenceIndex: nextIndex,
        },
    winners,
  };
}

export async function createManualBid(input: {
  roundId: string;
  name: string;
  amount: number;
  createdByUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não configurado");
  const round = await ensureCurrentRound();
  if (round.id !== input.roundId)
    throw new Error("A rodada informada não é a rodada atual");
  const allBids = await getRoundBids(round.id);
  const currentBid = allBids[0]?.amount ?? 0;
  if (input.amount <= currentBid)
    throw new Error("O lance precisa ser maior que o maior lance atual");
  const result = await db.insert(manualBids).values({
    roundId: round.id,
    name: input.name.trim(),
    amount: input.amount.toFixed(2),
    createdByUserId: input.createdByUserId,
  });
  const insertedId = Number(
    (result as unknown as [{ insertId?: number }, unknown])[0]?.insertId ?? 0,
  );
  return {
    id: insertedId,
    roundId: round.id,
    name: input.name.trim(),
    amount: input.amount,
    createdAt: new Date(),
  };
}

export async function applySyncPayWebhook(input: {
  identifier: string;
  status: "pending" | "paid" | "expired" | "failed";
  amount?: number;
  payload: unknown;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não configurado");

  const current = await db
    .select()
    .from(pixCharges)
    .where(eq(pixCharges.identifier, input.identifier))
    .limit(1);
  const charge = current[0];
  if (!charge) return undefined;

  if (input.amount !== undefined && Number.isFinite(input.amount)) {
    const expected = Number(charge.amount);
    if (Math.abs(expected - input.amount) > 0.009) {
      throw new Error("Valor do webhook não corresponde ao valor da cobrança");
    }
  }

  const finalStatus =
    charge.status === "paid" && input.status !== "paid" ? "paid" : input.status;
  await db
    .update(pixCharges)
    .set({
      status: finalStatus,
      providerPayload: JSON.stringify(input.payload),
      paidAt:
        finalStatus === "paid" ? (charge.paidAt ?? new Date()) : charge.paidAt,
    })
    .where(eq(pixCharges.id, charge.id));

  const existingBid = await db
    .select()
    .from(bids)
    .where(eq(bids.pixChargeId, charge.id))
    .limit(1);
  if (shouldCreateBidForPix(finalStatus, Boolean(existingBid[0]))) {
    // O índice único em pixChargeId e o upsert tornam webhooks repetidos seguros.
    await db
      .insert(bids)
      .values({
        userId: charge.userId,
        roundId: charge.roundId,
        pixChargeId: charge.id,
        amount: charge.amount,
      })
      .onDuplicateKeyUpdate({ set: { pixChargeId: sql`pixChargeId` } });
  }

  return { ...charge, status: finalStatus };
}
