import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getAdminFromRequest } from "./adminAuth";
import { sdk } from "./sdk";

export type AdminSession = {
  email: string;
  role: "admin";
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  admin: AdminSession | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  let admin: AdminSession | null = null;
  try {
    admin = await getAdminFromRequest(opts.req as any);
  } catch (error) {
    admin = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    admin,
  };
}
