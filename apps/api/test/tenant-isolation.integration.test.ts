import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import test from "node:test";
import { runMigrations } from "../scripts/migrate";

const migrationUrl = process.env.DATABASE_URL_MIGRATION;
const runtimeUrl = process.env.DATABASE_URL;
const enabled = Boolean(migrationUrl && runtimeUrl);

test(
  "PostgreSQL runtime role enforces tenant RLS and transaction-local context",
  { skip: !enabled },
  async () => {
    await runMigrations();
    const owner = new Pool({ connectionString: migrationUrl, max: 1 });
    const runtime = new Pool({ connectionString: runtimeUrl, max: 1 });

    const userA = randomUUID();
    const userB = randomUUID();
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const storeA = randomUUID();
    const storeB = randomUUID();
    const phoneSuffix = randomUUID().replaceAll("-", "").slice(0, 8);

    try {
      await owner.query(
        "INSERT INTO users (id, display_name, phone_e164) VALUES ($1, $2, $3), ($4, $5, $6)",
        [
          userA,
          "Tenant A User",
          `+98912${phoneSuffix}`,
          userB,
          "Tenant B User",
          `+98913${phoneSuffix}`,
        ],
      );
      await owner.query(
        "INSERT INTO tenants (id, display_name, created_by_user_id) VALUES ($1, $2, $3), ($4, $5, $6)",
        [tenantA, "Tenant A", userA, tenantB, "Tenant B", userB],
      );
      await owner.query(
        "INSERT INTO stores (id, tenant_id, name) VALUES ($1, $2, $3), ($4, $5, $6)",
        [storeA, tenantA, "Store A", storeB, tenantB, "Store B"],
      );
      await owner.query(
        "INSERT INTO tenant_memberships (tenant_id, user_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE'), ($3, $4, 'OWNER', 'ACTIVE')",
        [tenantA, userA, tenantB, userB],
      );

      const client = await runtime.connect();
      try {
        await client.query("BEGIN");
        const role = await client.query(
          "SELECT current_user AS role_name, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user",
        );
        assert.equal(role.rows[0]?.role_name, "marketfa_runtime");
        assert.equal(role.rows[0]?.rolsuper, false);
        assert.equal(role.rows[0]?.rolbypassrls, false);

        await client.query(
          "SELECT set_config('app.current_user_id', $1, true)",
          [userA],
        );
        await client.query(
          "SELECT set_config('app.current_tenant_id', $1, true)",
          [tenantA],
        );

        const visible = await client.query("SELECT id FROM stores ORDER BY id");
        assert.deepEqual(
          visible.rows.map((row) => row.id),
          [storeA],
        );

        const hidden = await client.query(
          "SELECT id FROM stores WHERE tenant_id = $1",
          [tenantB],
        );
        assert.equal(hidden.rowCount, 0);

        await assert.rejects(
          client.query(
            "INSERT INTO stores (id, tenant_id, name) VALUES ($1, $2, $3)",
            [randomUUID(), tenantB, "Forbidden Store"],
          ),
        );
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }

      const reused = await runtime.connect();
      try {
        await reused.query("BEGIN");
        await reused.query(
          "SELECT set_config('app.current_user_id', $1, true)",
          [userA],
        );
        const noTenantContext = await reused.query("SELECT id FROM stores");
        assert.equal(noTenantContext.rowCount, 0);
        await reused.query("ROLLBACK");
      } finally {
        reused.release();
      }
    } finally {
      await owner.query(
        "DELETE FROM stores WHERE tenant_id = ANY($1::uuid[])",
        [[tenantA, tenantB]],
      );
      await owner.query("DELETE FROM tenants WHERE id = ANY($1::uuid[])", [
        [tenantA, tenantB],
      ]);
      await owner.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        [userA, userB],
      ]);
      await Promise.all([owner.end(), runtime.end()]);
    }
  },
);
