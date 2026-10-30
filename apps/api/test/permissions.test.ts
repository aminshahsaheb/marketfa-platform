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

test("manager can operate retail workflows but cannot administer tenant ownership", () => {
  assert.equal(hasPermission("MANAGER", "catalog:write"), true);
  assert.equal(hasPermission("MANAGER", "purchasing:write"), true);
  assert.equal(hasPermission("MANAGER", "inventory:write"), true);
  assert.equal(hasPermission("MANAGER", "refund:approve"), true);
  assert.equal(hasPermission("MANAGER", "shift:manage"), true);
  assert.equal(hasPermission("MANAGER", "members:manage"), false);
  assert.equal(hasPermission("MANAGER", "tenant:manage"), false);
  assert.equal(hasPermission("MANAGER", "period:close"), false);
  assert.equal(hasPermission("MANAGER", "backup:manage"), false);
});

test("viewer is read-only and cannot execute financial or operational writes", () => {
  assert.equal(hasPermission("VIEWER", "catalog:read"), true);
  assert.equal(hasPermission("VIEWER", "inventory:read"), true);
  assert.equal(hasPermission("VIEWER", "reports:read"), true);
  assert.equal(hasPermission("VIEWER", "catalog:write"), false);
  assert.equal(hasPermission("VIEWER", "inventory:write"), false);
  assert.equal(hasPermission("VIEWER", "pos:sell"), false);
  assert.equal(hasPermission("VIEWER", "ledger:read"), false);
  assert.equal(hasPermission("VIEWER", "reports:financial"), false);
});
