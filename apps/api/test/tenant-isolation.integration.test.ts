import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import test from "node:test";
import { runMigrations } from "../scripts/migrate";
import {
  DatabaseService,
  TenantPermissionDeniedError,
} from "../src/database/database.service";

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
    const userC = randomUUID();
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const storeA = randomUUID();
    const storeB = randomUUID();
    const storeA2 = randomUUID();
    const terminalA = randomUUID();
    const phoneSuffix = randomUUID().replaceAll("-", "").slice(0, 8);

    try {
      await owner.query(
        "INSERT INTO users (id, display_name, phone_e164) VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9)",
        [
          userA,
          "Tenant A Owner",
          `+98912${phoneSuffix}`,
          userB,
          "Tenant B Owner",
          `+98913${phoneSuffix}`,
          userC,
          "Tenant A Cashier",
          `+98914${phoneSuffix}`,
        ],
      );
      await owner.query(
        "INSERT INTO tenants (id, display_name, created_by_user_id) VALUES ($1, $2, $3), ($4, $5, $6)",
        [tenantA, "Tenant A", userA, tenantB, "Tenant B", userB],
      );
      await owner.query(
        "INSERT INTO stores (id, tenant_id, name) VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9)",
        [
          storeA,
          tenantA,
          "Store A",
          storeB,
          tenantB,
          "Store B",
          storeA2,
          tenantA,
          "Store A2",
        ],
      );
      await owner.query(
        "INSERT INTO tenant_memberships (tenant_id, user_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE'), ($3, $4, 'OWNER', 'ACTIVE'), ($1, $5, 'CASHIER', 'ACTIVE')",
        [tenantA, userA, tenantB, userB, userC],
      );
      const parentSession = randomUUID();
      await owner.query(
        "INSERT INTO user_sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, now() + interval '1 day')",
        [parentSession, userA, randomBytes(32)],
      );
      await assert.rejects(
        owner.query(
          "INSERT INTO user_sessions (user_id, token_hash, expires_at, rotation_parent_id) VALUES ($1, $2, now() + interval '1 day', $3)",
          [userB, randomBytes(32), parentSession],
        ),
      );

      await assert.rejects(
        owner.query(
          "INSERT INTO terminals (tenant_id, store_id, name, credential_hash, status) VALUES ($1, $2, 'Invalid revoked terminal', $3, 'REVOKED')",
          [tenantA, storeA, randomBytes(32)],
        ),
      );

      await owner.query(
        "INSERT INTO terminals (id, tenant_id, store_id, name, credential_hash) VALUES ($1, $2, $3, $4, $5)",
        [terminalA, tenantA, storeA, "Terminal A", randomBytes(32)],
      );
      await owner.query(
        "INSERT INTO terminal_assignments (tenant_id, store_id, terminal_id, user_id) VALUES ($1, $2, $3, $4)",
        [tenantA, storeA, terminalA, userA],
      );
      await assert.rejects(
        owner.query(
          "INSERT INTO terminal_assignments (tenant_id, store_id, terminal_id, user_id) VALUES ($1, $2, $3, $4)",
          [tenantA, storeA, terminalA, userA],
        ),
      );
      await assert.rejects(
        owner.query(
          "INSERT INTO terminal_assignments (tenant_id, store_id, terminal_id, user_id) VALUES ($1, $2, $3, $4)",
          [tenantA, storeA2, terminalA, userA],
        ),
      );

      const databaseService = new DatabaseService(runtime);
      const ownerVisibleStores = await databaseService.withTenantPermission(
        { userId: userA },
        tenantA,
        "members:manage",
        async (client) => {
          const result = await client.query(
            "SELECT id FROM stores ORDER BY id",
          );
          return result.rows.map((row) => row.id);
        },
      );
      assert.deepEqual(ownerVisibleStores, [storeA, storeA2].sort());

      await assert.rejects(
        databaseService.withTenantPermission(
          { userId: userC },
          tenantA,
          "members:manage",
          async () => "must not execute",
        ),
        TenantPermissionDeniedError,
      );

      const client = await runtime.connect();
      try {
        await client.query("BEGIN");
        const loginRole = await client.query(
          "SELECT session_user AS role_name, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = session_user",
        );
        assert.equal(loginRole.rows[0]?.role_name, "marketfa_runtime");
        assert.equal(loginRole.rows[0]?.rolsuper, false);
        assert.equal(loginRole.rows[0]?.rolbypassrls, false);

        const directPrivileges = await client.query(
          "SELECT has_table_privilege('marketfa_runtime', 'stores', 'SELECT') AS can_read_without_role_switch",
        );
        assert.equal(
          directPrivileges.rows[0]?.can_read_without_role_switch,
          false,
        );

        await client.query("SET LOCAL ROLE marketfa_app");
        const role = await client.query(
          "SELECT current_user AS role_name, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname = current_user",
        );
        assert.equal(role.rows[0]?.role_name, "marketfa_app");
        assert.equal(role.rows[0]?.rolsuper, false);
        assert.equal(role.rows[0]?.rolbypassrls, false);
        assert.equal(role.rows[0]?.rolcanlogin, false);

        const writePrivileges = await client.query(
          `SELECT
             has_table_privilege(current_user, 'users', 'UPDATE') AS can_update_users,
             has_table_privilege(current_user, 'auth_identities', 'INSERT') AS can_insert_identities,
             has_table_privilege(current_user, 'user_sessions', 'INSERT') AS can_insert_sessions,
             has_table_privilege(current_user, 'tenant_memberships', 'UPDATE') AS can_update_memberships,
             has_table_privilege(current_user, 'tenant_invitations', 'INSERT') AS can_create_invitations,
             has_table_privilege(current_user, 'terminals', 'INSERT') AS can_create_terminals`,
        );
        for (const value of Object.values(writePrivileges.rows[0] ?? {})) {
          assert.equal(value, false);
        }

        await client.query(
          "SELECT set_config('app.current_user_id', $1, true)",
          [userA],
        );
        await client.query(
          "SELECT set_config('app.current_tenant_id', $1, true)",
          [tenantA],
        );

        const assertDenied = async (statement: string, values: unknown[]) => {
          await client.query("SAVEPOINT expected_denial");
          await assert.rejects(client.query(statement, values));
          await client.query("ROLLBACK TO SAVEPOINT expected_denial");
          await client.query("RELEASE SAVEPOINT expected_denial");
        };

        const visible = await client.query("SELECT id FROM stores ORDER BY id");
        assert.deepEqual(
          visible.rows.map((row) => row.id),
          [storeA, storeA2].sort(),
        );

        const hidden = await client.query(
          "SELECT id FROM stores WHERE tenant_id = $1",
          [tenantB],
        );
        assert.equal(hidden.rowCount, 0);

        await assertDenied(
          "UPDATE tenant_memberships SET role = 'OWNER' WHERE tenant_id = $1 AND user_id = $2",
          [tenantA, userC],
        );

        await assertDenied(
          "INSERT INTO audit_events (tenant_id, actor_user_id, action, entity_type) VALUES ($1, $2, 'test', 'test')",
          [tenantA, userC],
        );

        await client.query(
          "INSERT INTO audit_events (tenant_id, actor_user_id, action, entity_type) VALUES ($1, $2, 'test', 'test')",
          [tenantA, userA],
        );

        await assertDenied(
          "INSERT INTO audit_events (tenant_id, action, entity_type) VALUES ($1, 'test', 'test')",
          [tenantB],
        );
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }

      const reused = await runtime.connect();
      try {
        await reused.query("BEGIN");
        await reused.query("SET LOCAL ROLE marketfa_app");
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
        "DELETE FROM terminal_assignments WHERE tenant_id = ANY($1::uuid[])",
        [[tenantA, tenantB]],
      );
      await owner.query(
        "DELETE FROM terminals WHERE tenant_id = ANY($1::uuid[])",
        [[tenantA, tenantB]],
      );
      await owner.query(
        "DELETE FROM stores WHERE tenant_id = ANY($1::uuid[])",
        [[tenantA, tenantB]],
      );
      await owner.query("DELETE FROM tenants WHERE id = ANY($1::uuid[])", [
        [tenantA, tenantB],
      ]);
      await owner.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        [userA, userB, userC],
      ]);
      await Promise.all([owner.end(), runtime.end()]);
    }
  },
);
