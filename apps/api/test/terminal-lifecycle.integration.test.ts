import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import {
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Pool } from "pg";
import test from "node:test";
import { runMigrations } from "../scripts/migrate";
import { DatabaseService } from "../src/database/database.service";
import { TenantBootstrapService } from "../src/tenancy/tenant-bootstrap.service";
import { TerminalService } from "../src/tenancy/terminal.service";

const migrationUrl = process.env.DATABASE_URL_MIGRATION;
const runtimeUrl = process.env.DATABASE_URL;
const enabled = Boolean(migrationUrl && runtimeUrl);

test(
  "terminal lifecycle registers, rotates, suspends, revokes, and audits credentials",
  { skip: !enabled },
  async () => {
    await runMigrations();
    const owner = new Pool({ connectionString: migrationUrl, max: 1 });
    const runtime = new Pool({ connectionString: runtimeUrl, max: 6 });
    const ownerId = randomUUID();
    const managerId = randomUUID();
    const tenantIds: string[] = [];

    try {
      await owner.query(
        "INSERT INTO users (id, display_name, status) VALUES ($1, 'Terminal Owner', 'ACTIVE'), ($2, 'Terminal Manager', 'ACTIVE')",
        [ownerId, managerId],
      );

      const database = new DatabaseService(runtime);
      const bootstrap = new TenantBootstrapService(database);
      const terminals = new TerminalService(database);
      const tenant = await bootstrap.create(
        { userId: ownerId },
        {
          displayName: "Terminal Test",
          legalName: null,
          storeName: "Main Store",
        },
      );
      tenantIds.push(tenant.tenantId);

      await owner.query(
        "INSERT INTO tenant_memberships (tenant_id, user_id, role, status) VALUES ($1, $2, 'MANAGER', 'ACTIVE')",
        [tenant.tenantId, managerId],
      );

      const created = await terminals.register(
        { userId: ownerId },
        tenant.tenantId,
        tenant.storeId,
        "Front POS",
      );
      assert.equal(created.status, "ACTIVE");
      assert.equal(created.name, "Front POS");
      assert.equal(created.credential.length, 43);

      const createdHash = createHash("sha256")
        .update(Buffer.from(created.credential, "base64url"))
        .digest();
      const stored = await owner.query<{ credential_hash: Buffer }>(
        "SELECT credential_hash FROM terminals WHERE tenant_id = $1 AND id = $2",
        [tenant.tenantId, created.terminalId],
      );
      assert.ok(stored.rows[0]?.credential_hash.equals(createdHash));

      await assert.rejects(
        terminals.register(
          { userId: managerId },
          tenant.tenantId,
          tenant.storeId,
          "Manager POS",
        ),
        ForbiddenException,
      );
      await assert.rejects(
        terminals.rotateCredential(
          { userId: managerId },
          tenant.tenantId,
          created.terminalId,
        ),
        ForbiddenException,
      );

      await assert.rejects(
        terminals.register(
          { userId: ownerId },
          tenant.tenantId,
          randomUUID(),
          "Wrong Store",
        ),
        NotFoundException,
      );

      const rotated = await terminals.rotateCredential(
        { userId: ownerId },
        tenant.tenantId,
        created.terminalId,
      );
      assert.equal(rotated.status, "ACTIVE");
      assert.notEqual(rotated.credential, created.credential);
      const rotatedHash = createHash("sha256")
        .update(Buffer.from(rotated.credential, "base64url"))
        .digest();
      const afterRotation = await owner.query<{ credential_hash: Buffer }>(
        "SELECT credential_hash FROM terminals WHERE tenant_id = $1 AND id = $2",
        [tenant.tenantId, created.terminalId],
      );
      assert.ok(afterRotation.rows[0]?.credential_hash.equals(rotatedHash));

      await owner.query(
        "INSERT INTO terminal_assignments (tenant_id, store_id, terminal_id, user_id) VALUES ($1, $2, $3, $4)",
        [tenant.tenantId, tenant.storeId, created.terminalId, ownerId],
      );

      const suspended = await terminals.suspend(
        { userId: ownerId },
        tenant.tenantId,
        created.terminalId,
      );
      assert.equal(suspended.status, "SUSPENDED");
      const suspendedAgain = await terminals.suspend(
        { userId: ownerId },
        tenant.tenantId,
        created.terminalId,
      );
      assert.equal(suspendedAgain.status, "SUSPENDED");

      const revoked = await terminals.revoke(
        { userId: ownerId },
        tenant.tenantId,
        created.terminalId,
      );
      assert.equal(revoked.status, "REVOKED");
      assert.ok(revoked.revokedAt);
      const revokedAgain = await terminals.revoke(
        { userId: ownerId },
        tenant.tenantId,
        created.terminalId,
      );
      assert.equal(revokedAgain.status, "REVOKED");
      await assert.rejects(
        terminals.rotateCredential(
          { userId: ownerId },
          tenant.tenantId,
          created.terminalId,
        ),
        NotFoundException,
      );

      const assignments = await owner.query<{ revoked_at: Date | null }>(
        "SELECT revoked_at FROM terminal_assignments WHERE tenant_id = $1 AND terminal_id = $2",
        [tenant.tenantId, created.terminalId],
      );
      assert.ok(assignments.rows[0]?.revoked_at);

      const audit = await owner.query<{
        action: string;
        metadata: string;
      }>(
        "SELECT action, metadata::text AS metadata FROM audit_events WHERE tenant_id = $1 AND entity_type = 'terminal'",
        [tenant.tenantId],
      );
      assert.deepEqual(
        audit.rows.map((row) => row.action).sort(),
        [
          "tenant.terminal.register",
          "tenant.terminal.credential.rotate",
          "tenant.terminal.suspend",
          "tenant.terminal.revoke",
        ].sort(),
      );
      assert.ok(
        audit.rows.every(
          (row) =>
            !row.metadata.includes(created.credential) &&
            !row.metadata.includes(rotated.credential),
        ),
      );
    } finally {
      for (const tenantId of tenantIds) {
        await owner.query("DELETE FROM audit_events WHERE tenant_id = $1", [
          tenantId,
        ]);
        await owner.query(
          "DELETE FROM terminal_assignments WHERE tenant_id = $1",
          [tenantId],
        );
        await owner.query("DELETE FROM terminals WHERE tenant_id = $1", [
          tenantId,
        ]);
        await owner.query(
          "DELETE FROM tenant_memberships WHERE tenant_id = $1",
          [tenantId],
        );
        await owner.query("DELETE FROM stores WHERE tenant_id = $1", [
          tenantId,
        ]);
        await owner.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
      }
      await owner.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        [ownerId, managerId],
      ]);
      await Promise.all([owner.end(), runtime.end()]);
    }
  },
);
