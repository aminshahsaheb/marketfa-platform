import assert from "node:assert/strict";
import test from "node:test";
import { hasPermission } from "../src/tenancy/permissions";

test("owner can access all defined permissions", () => {
  const permissions = [
    "tenant:manage",
    "members:manage",
    "catalog:read",
    "catalog:write",
    "purchasing:write",
    "inventory:read",
    "inventory:write",
    "pos:sell",
    "pos:discount",
    "refund:request",
    "refund:approve",
    "shift:operate",
    "shift:manage",
    "ledger:read",
    "journal:draft",
    "journal:approve",
    "period:close",
    "reports:read",
    "reports:financial",
    "backup:manage",
  ] as const;

  for (const permission of permissions) {
    assert.equal(hasPermission("OWNER", permission), true);
  }
});

test("cashier cannot approve refunds, close periods, or manage members", () => {
  assert.equal(hasPermission("CASHIER", "pos:sell"), true);
  assert.equal(hasPermission("CASHIER", "refund:request"), true);
  assert.equal(hasPermission("CASHIER", "refund:approve"), false);
  assert.equal(hasPermission("CASHIER", "period:close"), false);
  assert.equal(hasPermission("CASHIER", "members:manage"), false);
});

test("accountant has financial read and draft access, not POS access", () => {
  assert.equal(hasPermission("ACCOUNTANT", "ledger:read"), true);
  assert.equal(hasPermission("ACCOUNTANT", "journal:draft"), true);
  assert.equal(hasPermission("ACCOUNTANT", "journal:approve"), false);
  assert.equal(hasPermission("ACCOUNTANT", "pos:sell"), false);
});
