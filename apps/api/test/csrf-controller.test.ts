import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import type { Response } from "express";
import { CSRF_COOKIE_NAME } from "../src/auth/auth.constants";
import { CsrfController } from "../src/auth/csrf.controller";

test("CSRF bootstrap sets a readable root-path cookie and disables caching", () => {
  const headers = new Map<string, string>();
  const response = {
    setHeader: (name: string, value: string) => {
      headers.set(name, value);
    },
  };
  const controller = new CsrfController();
  assert.deepEqual(controller.csrf(response as unknown as Response), {
    status: "ok",
  });

  const cookie = headers.get("Set-Cookie");
  assert.ok(cookie);
  assert.match(cookie, new RegExp(`^${CSRF_COOKIE_NAME}=[A-Za-z0-9_-]{43};`));
  assert.match(cookie, /; Path=\//);
  assert.doesNotMatch(cookie, /HttpOnly/);
  assert.equal(headers.get("Cache-Control"), "no-store");
});
