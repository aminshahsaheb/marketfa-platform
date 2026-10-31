import { randomBytes } from "node:crypto";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "./auth.constants";

const SESSION_COOKIE_PATH = "/api/v1";
const CSRF_COOKIE_PATH = "/";
const COOKIE_SAME_SITE = "Lax";

function secureAttribute(): string {
  return process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "test"
    ? ""
    : "; Secure";
}

function maxAgeSeconds(expiresAt: string, now: number): number {
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry)) {
    throw new Error("Invalid session expiry.");
  }
  return Math.max(0, Math.floor((expiry - now) / 1000));
}

function validateToken(value: string): void {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new Error("Invalid cookie token.");
  }
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length !== 32 || decoded.toString("base64url") !== value) {
    throw new Error("Invalid cookie token.");
  }
}

export function createCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export function buildSessionCookie(
  token: string,
  expiresAt: string,
  now = Date.now(),
): string {
  validateToken(token);
  const maxAge = maxAgeSeconds(expiresAt, now);
  return `${SESSION_COOKIE_NAME}=${token}; Path=${SESSION_COOKIE_PATH}; Max-Age=${maxAge}; HttpOnly; SameSite=${COOKIE_SAME_SITE}${secureAttribute()}`;
}

export function buildCsrfCookie(
  token: string,
  expiresAt: string,
  now = Date.now(),
): string {
  validateToken(token);
  const maxAge = maxAgeSeconds(expiresAt, now);
  return `${CSRF_COOKIE_NAME}=${token}; Path=${CSRF_COOKIE_PATH}; Max-Age=${maxAge}; SameSite=${COOKIE_SAME_SITE}${secureAttribute()}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=${SESSION_COOKIE_PATH}; Max-Age=0; HttpOnly; SameSite=${COOKIE_SAME_SITE}${secureAttribute()}`;
}

export function clearCsrfCookie(): string {
  return `${CSRF_COOKIE_NAME}=; Path=${CSRF_COOKIE_PATH}; Max-Age=0; SameSite=${COOKIE_SAME_SITE}${secureAttribute()}`;
}
