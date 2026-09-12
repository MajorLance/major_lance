import { decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const customerProfiles = mysqlTable("customer_profiles", {
  id: int("id").autoincrement().primaryKey(),
  fullName: varchar("fullName", { length: 120 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 30 }).notNull(),
  pixKeyType: mysqlEnum("pixKeyType", ["cpf", "cnpj", "email", "phone", "random"]).notNull(),
  pixKey: varchar("pixKey", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  createdAtIdx: index("customer_profiles_created_at_idx").on(table.createdAt),
}));

export const pixCharges = mysqlTable("pix_charges", {
  id: int("id").autoincrement().primaryKey(),
  identifier: varchar("identifier", { length: 64 }).notNull().unique(),
  requestKey: varchar("requestKey", { length: 64 }).notNull().unique(),
  userId: int("userId").notNull(),
  roundId: varchar("roundId", { length: 64 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  pixCode: text("pixCode").notNull(),
  status: mysqlEnum("status", ["pending", "paid", "expired", "failed"]).default("pending").notNull(),
  providerPayload: text("providerPayload"),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  userIdx: index("pix_charges_user_idx").on(table.userId),
  statusIdx: index("pix_charges_status_idx").on(table.status),
}));

export const bids = mysqlTable("bids", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  roundId: varchar("roundId", { length: 64 }).notNull(),
  pixChargeId: int("pixChargeId").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  roundIdx: index("bids_round_idx").on(table.roundId),
  userIdx: index("bids_user_idx").on(table.userId),
  chargeIdx: uniqueIndex("bids_charge_idx").on(table.pixChargeId),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type CustomerProfile = typeof customerProfiles.$inferSelect;
export type InsertCustomerProfile = typeof customerProfiles.$inferInsert;
export type PixCharge = typeof pixCharges.$inferSelect;
export type Bid = typeof bids.$inferSelect;

export const auctionRounds = mysqlTable("auction_rounds", {
  id: varchar("id", { length: 64 }).primaryKey(),
  sequenceIndex: int("sequenceIndex").notNull(),
  prize: decimal("prize", { precision: 12, scale: 2 }).notNull(),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt").notNull(),
  status: mysqlEnum("status", ["scheduled", "active", "finished"]).default("scheduled").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  statusIdx: index("auction_rounds_status_idx").on(table.status),
  endsAtIdx: index("auction_rounds_ends_at_idx").on(table.endsAt),
}));

export const manualBids = mysqlTable("manual_bids", {
  id: int("id").autoincrement().primaryKey(),
  roundId: varchar("roundId", { length: 64 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  roundIdx: index("manual_bids_round_idx").on(table.roundId),
  createdAtIdx: index("manual_bids_created_at_idx").on(table.createdAt),
}));

export const winners = mysqlTable("winners", {
  id: int("id").autoincrement().primaryKey(),
  roundId: varchar("roundId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  prize: decimal("prize", { precision: 12, scale: 2 }).notNull(),
  winningBid: decimal("winningBid", { precision: 12, scale: 2 }).notNull(),
  wonAt: timestamp("wonAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  wonAtIdx: index("winners_won_at_idx").on(table.wonAt),
}));

export const walletAccounts = mysqlTable("wallet_accounts", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull().unique(),
  balance: decimal("balance", { precision: 12, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const walletTransactions = mysqlTable("wallet_transactions", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  kind: mysqlEnum("kind", ["prize", "withdrawal"]).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  roundId: varchar("roundId", { length: 64 }),
  idempotencyKey: varchar("idempotencyKey", { length: 120 }).notNull().unique(),
  description: varchar("description", { length: 180 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  customerIdx: index("wallet_transactions_customer_idx").on(table.customerId),
}));

export type AuctionRound = typeof auctionRounds.$inferSelect;
export type ManualBid = typeof manualBids.$inferSelect;
export type Winner = typeof winners.$inferSelect;
export type WalletAccount = typeof walletAccounts.$inferSelect;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
