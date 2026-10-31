import "reflect-metadata";
import assert from "node:assert/strict";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import test from "node:test";
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  IS_PUBLIC_KEY,
  SESSION_COOKIE_NAME,
} from "../src/auth/auth.constants";
import { CsrfGuard } from "../src/auth/csrf.guard";
import { SessionAuthGuard } from "../src/auth/session-auth.guard";
import type { RequestActor } from "../src/auth/auth.types";
import type { SessionService } from "../src/sessions/session.service";

type Handler = (...args: never[]) => unknown;
type ClassRef = new (...args: never[]) => unknown;

function makeContext(
  request: object,
  handler: Handler = () => undefined,
  classRef: ClassRef = class TestController {},
): ExecutionContext {
  const context = {
    getHandler: () => handler,
    getClass: () => classRef,
    switchToHttp: () => ({ getRequest: () => request }),
  };
  return context as unknown as ExecutionContext;
}

test("session auth guard skips public handlers", async () => {
  const handler = () => undefined;
  Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
  const sessions = {
    resolve: async () => {
      throw new Error("must not resolve");
    },
  };
  const guard = new SessionAuthGuard(
    new Reflector(),
    sessions as unknown as SessionService,
  );
  assert.equal(
    await guard.canActivate(makeContext({ headers: {} }, handler)),
    true,
  );
});

test("session auth guard rejects missing and duplicate session cookies", async () => {
  const sessions = { resolve: async () => null };
  const guard = new SessionAuthGuard(
    new Reflector(),
    sessions as unknown as SessionService,
  );
  await assert.rejects(
    guard.canActivate(makeContext({ headers: {} })),
    UnauthorizedException,
  );
  await assert.rejects(
    guard.canActivate(
      makeContext({
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=first; ${SESSION_COOKIE_NAME}=second`,
        },
      }),
    ),
    UnauthorizedException,
  );
});

test("session auth guard resolves the server-side actor from the session cookie", async () => {
  const token = Buffer.alloc(32, 7).toString("base64url");
  const sessions = {
    resolve: async (value: unknown) =>
      value === token
        ? {
            sessionId: "session-1",
            userId: "user-1",
            expiresAt: "2030-01-01T00:00:00.000Z",
          }
        : null,
  };
  const guard = new SessionAuthGuard(
    new Reflector(),
    sessions as unknown as SessionService,
  );
  const request: { headers: { cookie: string }; auth?: RequestActor } = {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
  };
  assert.equal(await guard.canActivate(makeContext(request)), true);
  assert.deepEqual(request.auth, { userId: "user-1", sessionId: "session-1" });
});

test("CSRF guard permits safe methods without a token", () => {
  const guard = new CsrfGuard();
  assert.equal(
    guard.canActivate(makeContext({ method: "GET", headers: {} })),
    true,
  );
});

test("CSRF guard rejects missing or untrusted origins", () => {
  const previous = process.env.CSRF_TRUSTED_ORIGINS;
  process.env.CSRF_TRUSTED_ORIGINS = "https://marketfa.example";
  const guard = new CsrfGuard();
  try {
    assert.throws(
      () => guard.canActivate(makeContext({ method: "POST", headers: {} })),
      ForbiddenException,
    );
    assert.throws(
      () =>
        guard.canActivate(
          makeContext({
            method: "POST",
            headers: { origin: "https://evil.example" },
          }),
        ),
      ForbiddenException,
    );
  } finally {
    if (previous === undefined) delete process.env.CSRF_TRUSTED_ORIGINS;
    else process.env.CSRF_TRUSTED_ORIGINS = previous;
  }
});

test("CSRF guard accepts matching double-submit tokens from a trusted origin", () => {
  const previous = process.env.CSRF_TRUSTED_ORIGINS;
  process.env.CSRF_TRUSTED_ORIGINS = "https://marketfa.example";
  const token = Buffer.alloc(32, 9).toString("base64url");
  const guard = new CsrfGuard();
  try {
    assert.equal(
      guard.canActivate(
        makeContext({
          method: "POST",
          headers: {
            origin: "https://marketfa.example",
            cookie: `${CSRF_COOKIE_NAME}=${token}`,
            [CSRF_HEADER_NAME]: token,
          },
        }),
      ),
      true,
    );
  } finally {
    if (previous === undefined) delete process.env.CSRF_TRUSTED_ORIGINS;
    else process.env.CSRF_TRUSTED_ORIGINS = previous;
  }
});

test("CSRF guard rejects mismatched double-submit tokens", () => {
  const previous = process.env.CSRF_TRUSTED_ORIGINS;
  process.env.CSRF_TRUSTED_ORIGINS = "https://marketfa.example";
  const cookieToken = Buffer.alloc(32, 9).toString("base64url");
  const headerToken = Buffer.alloc(32, 8).toString("base64url");
  const guard = new CsrfGuard();
  try {
    assert.throws(
      () =>
        guard.canActivate(
          makeContext({
            method: "PATCH",
            headers: {
              origin: "https://marketfa.example",
              cookie: `${CSRF_COOKIE_NAME}=${cookieToken}`,
              [CSRF_HEADER_NAME]: headerToken,
            },
          }),
        ),
      ForbiddenException,
    );
  } finally {
    if (previous === undefined) delete process.env.CSRF_TRUSTED_ORIGINS;
    else process.env.CSRF_TRUSTED_ORIGINS = previous;
  }
});
