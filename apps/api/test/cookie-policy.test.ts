import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCsrfCookie,
  buildSessionCookie,
  clearCsrfCookie,
  clearSessionCookie,
  createCsrfToken,
} from "../src/auth/cookie-policy";
import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "../src/auth/auth.constants";

test("session and CSRF cookie helpers use the required attributes", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const token = Buffer.alloc(32, 3).toString("base64url");
  const expiry = "2030-01-01T00:00:00.000Z";
  try {
    const sessionCookie = buildSessionCookie(
      token,
      expiry,
      Date.parse("2029-12-31T00:00:00.000Z"),
    );
    assert.ok(sessionCookie.startsWith(`${SESSION_COOKIE_NAME}=${token};`));
    assert.match(sessionCookie, /; HttpOnly;/);
    assert.match(sessionCookie, /; Secure$/);
    assert.match(sessionCookie, /; SameSite=Lax/);

    const csrfCookie = buildCsrfCookie(
      token,
      expiry,
      Date.parse("2029-12-31T00:00:00.000Z"),
    );
    assert.ok(csrfCookie.startsWith(`${CSRF_COOKIE_NAME}=${token};`));
    assert.match(csrfCookie, /; Path=\//);
    assert.doesNotMatch(csrfCookie, /HttpOnly/);
    assert.match(csrfCookie, /; Secure$/);

    assert.match(clearSessionCookie(), /Max-Age=0; HttpOnly/);
    assert.match(clearCsrfCookie(), /Max-Age=0; SameSite=Lax/);
    assert.match(clearCsrfCookie(), /; Path=\//);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("CSRF tokens are 256-bit canonical base64url values", () => {
  const token = createCsrfToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(Buffer.from(token, "base64url").length, 32);
});

test("session cookie helper rejects malformed bearer tokens", () => {
  assert.throws(() =>
    buildSessionCookie("not-a-token", "2030-01-01T00:00:00.000Z"),
  );
});
