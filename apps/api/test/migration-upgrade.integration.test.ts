import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import test from "node:test";
import { runMigrations } from "../scripts/migrate";

const migrationUrl = process.env.DATABASE_URL_MIGRATION;
const enabled = Boolean(
  migrationUrl && process.env.MIGRATION_TEST_DATABASE_CREATION === "true",
);

test(
  "migration 0010 backfills a tenant and store created under the legacy schema",
  { skip: !enabled },
  async () => {
    const databaseName = `marketfa_upgrade_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: migrationUrl, max: 1 });
    const isolatedUrl = new URL(migrationUrl!);
    isolatedUrl.pathname = `/${databaseName}`;
    const connectionString = isolatedUrl.toString();
    let databaseCreated = false;
    let legacy: Pool | undefined;

    try {
      await admin.query(`CREATE DATABASE ${databaseName}`);
      databaseCreated = true;

      await runMigrations({
        connectionString,
        targetVersion: "0009_accounting_schema",
      });

      legacy = new Pool({ connectionString, max: 1 });
      const userId = randomUUID();
      const phoneSuffix = randomUUID().replaceAll("-", "").slice(0, 7);
      await legacy.query(
        "INSERT INTO users (id, display_name, phone_e164, status) VALUES ($1, 'Legacy Owner', $2, 'ACTIVE')",
        [userId, `+98912${phoneSuffix}`],
      );

      const client = await legacy.connect();
      let tenantId: string;
      let storeId: string;
      try {
        await client.query("BEGIN");
        await client.query("SET LOCAL ROLE marketfa_app");
        await client.query(
          "SELECT set_config('app.current_user_id', $1, true)",
          [userId],
        );
        const result = await client.query<{
          created_tenant_id: string;
          created_store_id: string;
          owner_membership_id: string;
        }>(
          "SELECT * FROM public.tenant_bootstrap($1, $2, $3)",
          ["Legacy Retail", null, "Legacy Main Store"],
        );
        const row = result.rows[0];
        assert.ok(row?.created_tenant_id);
        assert.ok(row?.created_store_id);
        assert.ok(row?.owner_membership_id);
        tenantId = row.created_tenant_id;
        storeId = row.created_store_id;
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      await runMigrations({
        connectionString,
        targetVersion: "0010_multi_industry_business_profiles",
      });

      const profile = await legacy.query<{
        id: string;
        tenant_id: string;
        industry_key: string;
        industry_profile_version: number;
        accounting_book_id: string;
        created_by_user_id: string;
        currency_code: string;
      }>(
        `SELECT
           profile.id,
           profile.tenant_id,
           profile.industry_key,
           profile.industry_profile_version,
           profile.accounting_book_id,
           profile.created_by_user_id,
           book.currency_code
         FROM business_profiles AS profile
         JOIN accounting_books AS book
           ON book.tenant_id = profile.tenant_id
          AND book.id = profile.accounting_book_id
         WHERE profile.tenant_id = $1`,
        [tenantId],
      );
      assert.equal(profile.rowCount, 1);
      assert.equal(profile.rows[0]?.industry_key, "general-retail");
      assert.equal(profile.rows[0]?.industry_profile_version, 1);
      assert.equal(profile.rows[0]?.created_by_user_id, userId);
      assert.equal(profile.rows[0]?.currency_code, "IRR");

      const store = await legacy.query<{
        id: string;
        business_profile_id: string;
      }>(
        "SELECT id, business_profile_id FROM stores WHERE tenant_id = $1",
        [tenantId],
      );
      assert.equal(store.rowCount, 1);
      assert.equal(store.rows[0]?.id, storeId);
      assert.equal(store.rows[0]?.business_profile_id, profile.rows[0]?.id);

      const location = await legacy.query<{
        business_profile_id: string;
        store_id: string | null;
        location_type: string;
      }>(
        "SELECT business_profile_id, store_id, location_type FROM business_locations WHERE tenant_id = $1",
        [tenantId],
      );
      assert.equal(location.rowCount, 1);
      assert.equal(
        location.rows[0]?.business_profile_id,
        profile.rows[0]?.id,
      );
      assert.equal(location.rows[0]?.store_id, storeId);
      assert.equal(location.rows[0]?.location_type, "BRANCH");

      const capabilities = await legacy.query<{ status: string }>(
        "SELECT status FROM business_profile_capabilities WHERE tenant_id = $1 AND business_profile_id = $2",
        [tenantId, profile.rows[0]?.id],
      );
      assert.ok(capabilities.rowCount > 0);
      assert.equal(
        capabilities.rows.every((row) => row.status === "SUGGESTED"),
        true,
      );
    } finally {
      await legacy?.end();
      if (databaseCreated) {
        await admin.query(
          `DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`,
        );
      }
      await admin.end();
    }
  },
);
