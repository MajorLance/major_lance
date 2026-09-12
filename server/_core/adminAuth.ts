import { createHash, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { ENV } from "./env";

export const ADMIN_COOKIE_NAME = "admin_session";
export const ADMIN_SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 12;

function getAdminSecret() {
  const secret = ENV.cookieSecret || ENV.databaseUrl || "admin-secret-fallback";
  return new TextEncoder().encode(secret);
}

export function getAdminCredentials() {
  return {
    email: (ENV.adminEmail || process.env.ADMIN_EMAIL || "").trim().toLowerCase(),
    password: (ENV.adminPassword || process.env.ADMIN_PASSWORD || "") .toString(),
  };
}

export function verifyAdminCredentials(inputEmail: string, inputPassword: string) {
  const { email, password } = getAdminCredentials();
  if (!email || !password) return false;
  const normalizedEmail = inputEmail.trim().toLowerCase();
  const emailMatch = normalizedEmail.length === email.length && timingSafeEqual(Buffer.from(normalizedEmail), Buffer.from(email));
  if (!emailMatch) return false;
  const a = Buffer.from(inputPassword);
  const b = Buffer.from(password);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function createAdminSessionToken(email: string) {
  const secret = getAdminSecret();
  const issuedAt = Date.now();
  const exp = Math.floor((issuedAt + ADMIN_SESSION_MAX_AGE_MS) / 1000);
  return new SignJWT({ email: email.toLowerCase(), role: "admin", appId: ENV.appId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(exp)
    .sign(secret);
}

export async function verifyAdminSessionToken(token: string | undefined | null) {
  if (!token) return null;
  try {
    const secret = getAdminSecret();
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const email = (payload as any).email as string | undefined;
    const role = (payload as any).role as string | undefined;
    if (!email || role !== "admin") return null;
    const { email: expectedEmail } = getAdminCredentials();
    if (!expectedEmail) return null;
    if (email.toLowerCase() !== expectedEmail.toLowerCase()) return null;
    return { email: email.toLowerCase(), role: "admin" as const };
  } catch {
    return null;
  }
}

export async function getAdminFromRequest(req: Request) {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  let token = cookies[ADMIN_COOKIE_NAME];
  if (!token) {
    const auth = req.headers.authorization;
    if (typeof auth === "string" && auth.startsWith("Bearer ")) token = auth.slice(7);
  }
  return verifyAdminSessionToken(token);
}
