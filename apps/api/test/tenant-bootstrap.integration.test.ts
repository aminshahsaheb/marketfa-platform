import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ForbiddenException } from "@nestjs/common";
import { Pool } from "pg";
import test from "node:test";
import { runMigrations } from "../scripts/migrate";
import { DatabaseService } from "../src/database/database.service";
import { TenantBootstrapService } from "../src/tenancy/tenant-bootstrap.service";

const migrationUrl = process.env.DATABASE_URL_MIGRATION;
const runtimeUrl = process.env.DATABASE_URL;
const enabled = Boolean(migrationUrl && runtimeUrl);

test(
  "tenant bootstrap atomically creates tenant, first store, OWNER membership, and audit",
  { skip: !enabled },
  async () => {
    await runMigrations();
    const owner = new Pool({ connectionString: migrationUrl, max: 1 });
    const runtime = new Pool({ connectionString: runtimeUrl, max: 1 });
    const activeUserId = randomUUID();
    const suspendedUserId = randomUUID();
    let createdTenantId: string | undefined;

    try {
      await owner.query(
        "INSERT INTO users (id, display_name, status) VALUES ($1, 'Bootstrap User', 'ACTIVE'), ($2, 'Suspended User', 'SUSPENDED')",
        [activeUserId, suspendedUserId],
      );

      const database = new DatabaseService(runtime);
      const service = new TenantBootstrapService(database);
      const created = await service.create(
        { userId: activeUserId },
        {
          displayName: "Test Business",
          legalName: "Test Legal Name",
          storeName: "Main Store",
        },
      );
      createdTenantId = created.tenantId;

      assert.ok(created.tenantId);
      assert.ok(created.storeId);
      assert.ok(created.ownerMembershipId);

      const tenant = await owner.query<{
        display_name: string;
        legal_name: string | null;
        created_by_user_id: string;
      }>(
        "SELECT display_name, legal_name, created_by_user_id FROM tenants WHERE id = $1",
        [created.tenantId],
      );
      assert.deepEqual(tenant.rows[0], {
        display_name: "Test Business",
        legal_name: "Test Legal Name",
        created_by_user_id: activeUserId,
      });

      const store = await owner.query<{
        id: string;
        tenant_id: string;
        name: string;
        currency_code: string;
        money_display_unit: string;
      }>(
        "SELECT id, tenant_id, name, currency_code, money_display_unit FROM stores WHERE id = $1",
        [created.storeId],
      );
      assert.deepEqual(store.rows[0], {
        id: created.storeId,
        tenant_id: created.tenantId,
        name: "Main Store",
        currency_code: "IRR",
        money_display_unit: "TOMAN",
      });

      const membership = await owner.query<{
        id: string;
        tenant_id: string;
        user_id: string;
        role: string;
        status: string;
      }>(
        "SELECT id, tenant_id, user_id, role, status FROM tenant_memberships WHERE id = $1",
        [created.ownerMembershipId],
      );
      assert.deepEqual(membership.rows[0], {
        id: created.ownerMembershipId,
        tenant_id: created.tenantId,
        user_id: activeUserId,
        role: "OWNER",
        status: "ACTIVE",
      });

      const audit = await owner.query<{
        action: string;
        tenant_id: string;
        store_id: string;
        actor_user_id: string;
        entity_id: string;
      }>(
        "SELECT action, tenant_id, store_id, actor_user_id, entity_id FROM audit_events WHERE tenant_id = $1",
        [created.tenantId],
      );
      assert.deepEqual(audit.rows[0], {
        action: "tenant.bootstrap",
        tenant_id: created.tenantId,
        store_id: created.storeId,
        actor_user_id: activeUserId,
        entity_id: created.tenantId,
      });

      await assert.rejects(
        runtime.query(
          "INSERT INTO tenants (display_name, created_by_user_id) VALUES ('Direct write', $1)",
          [activeUserId],
        ),
      );

      const noTenantLeak = await database.withAuthenticatedActor(
        { userId: activeUserId },
        async (client) => {
          const result = await client.query(
            "SELECT app_current_tenant_id() AS tenant_id",
          );
          return result.rows[0]?.tenant_id;
        },
      );
      assert.equal(noTenantLeak, null);

      await assert.rejects(
        service.create(
          { userId: suspendedUserId },
          {
            displayName: "Should Not Exist",
            legalName: null,
            storeName: "Main Store",
          },
        ),
        ForbiddenException,
      );

      await assert.rejects(
        database.withAuthenticatedActor(
          { userId: activeUserId },
          async (client) =>
            client.query(
              "SELECT * FROM public.tenant_bootstrap($1, $2, $3)",
              ["   ", null, "Store"],
            ),
        ),
      );
    } finally {
      if (createdTenantId) {
        await owner.query(
          "DELETE FROM audit_events WHERE tenant_id = $1",
          [createdTenantId],
        );
        await owner.query("DELETE FROM stores WHERE tenant_id = $1", [
          createdTenantId,
        ]);
        await owner.query("DELETE FROM tenants WHERE id = $1", [
          createdTenantId,
        ]);
      }
      await owner.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        [activeUserId, suspendedUserId],
      ]);
      await Promise.all([owner.end(), runtime.end()]);
    }
  },
);
