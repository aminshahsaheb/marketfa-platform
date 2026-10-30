import assert from "node:assert/strict";
import type { Pool, PoolClient } from "pg";
import test from "node:test";
import {
  DatabaseService,
  TenantPermissionDeniedError,
} from "../src/database/database.service";
import type { TenantRole } from "../src/tenancy/permissions";

function createService(role: TenantRole) {
  const statements: string[] = [];
  const client = {
    query: async (statement: string) => {
      statements.push(statement);
      if (statement.includes("SELECT role")) {
        return { rows: [{ role }], rowCount: 1 };
      }
      if (statement.includes("SELECT status FROM tenants")) {
        return { rows: [{ status: "ACTIVE" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    release: () => undefined,
  } as unknown as PoolClient;

  const pool = {
    connect: async () => client,
    end: async () => undefined,
  } as unknown as Pool;

  return { service: new DatabaseService(pool), statements };
}

test("tenant database operations reject permissions absent from the actor role", async () => {
  const { service, statements } = createService("CASHIER");
  let operationCalled = false;

  await assert.rejects(
    service.withTenantPermission(
      { userId: "user-1" },
      "tenant-1",
      "members:manage",
      async () => {
        operationCalled = true;
      },
    ),
    TenantPermissionDeniedError,
  );

  assert.equal(operationCalled, false);
  assert.ok(statements.includes("ROLLBACK"));
  assert.ok(!statements.includes("COMMIT"));
});

test("tenant database operations execute and commit when the actor has permission", async () => {
  const { service, statements } = createService("CASHIER");

  const result = await service.withTenantPermission(
    { userId: "user-1" },
    "tenant-1",
    "pos:sell",
    async (_client, membership) => membership.role,
  );

  assert.equal(result, "CASHIER");
  assert.ok(statements.includes("COMMIT"));
  assert.ok(!statements.includes("ROLLBACK"));
});

test("owner can perform membership administration through the permission boundary", async () => {
  const { service } = createService("OWNER");

  const result = await service.withTenantPermission(
    { userId: "owner-1" },
    "tenant-1",
    "members:manage",
    async (_client, membership) => membership.role,
  );

  assert.equal(result, "OWNER");
});
