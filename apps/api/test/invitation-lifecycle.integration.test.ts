import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import test from "node:test";
import { runMigrations } from "../scripts/migrate";
import { DatabaseService } from "../src/database/database.service";
import { InvitationService } from "../src/tenancy/invitation.service";
import { TenantBootstrapService } from "../src/tenancy/tenant-bootstrap.service";

const migrationUrl = process.env.DATABASE_URL_MIGRATION;
const runtimeUrl = process.env.DATABASE_URL;
const enabled = Boolean(migrationUrl && runtimeUrl);

test(
  "invitation lifecycle creates, accepts once, revokes, and audits atomically",
  { skip: !enabled },
  async () => {
    await runMigrations();
    const owner = new Pool({ connectionString: migrationUrl, max: 1 });
    const runtime = new Pool({ connectionString: runtimeUrl, max: 1 });
    const inviterId = randomUUID();
    const inviteeId = randomUUID();
    const revokedInviteeId = randomUUID();
    const tenantIds: string[] = [];

    try {
      await owner.query(
        "INSERT INTO users (id, display_name, status) VALUES ($1, 'Inviter', 'ACTIVE'), ($2, 'Invitee', 'ACTIVE'), ($3, 'Revoked Invitee', 'ACTIVE')",
        [inviterId, inviteeId, revokedInviteeId],
      );
      await owner.query(
        "INSERT INTO auth_identities (user_id, provider_key, provider_subject, normalized_identifier, verified_at) VALUES ($1, 'test', $2, $2, now()), ($3, 'test', $4, $4, now())",
        [
          inviteeId,
          "invitee@example.test",
          revokedInviteeId,
          "revoked@example.test",
        ],
      );

      const database = new DatabaseService(runtime);
      const bootstrap = new TenantBootstrapService(database);
      const invitationService = new InvitationService(database);
      const tenant = await bootstrap.create(
        { userId: inviterId },
        {
          displayName: "Invitation Test",
          legalName: null,
          storeName: "Main Store",
        },
      );
      tenantIds.push(tenant.tenantId);

      const created = await invitationService.create(
        { userId: inviterId },
        tenant.tenantId,
        {
          intendedIdentifier: " Invitee@Example.Test ",
          role: "CASHIER",
        },
      );
      assert.equal(created.intendedIdentifier, "invitee@example.test");
      assert.equal(created.role, "CASHIER");
      assert.ok(created.token.length === 43);

      await assert.rejects(
        invitationService.create({ userId: inviterId }, tenant.tenantId, {
          intendedIdentifier: "invitee@example.test",
          role: "VIEWER",
        }),
      );

      await assert.rejects(
        invitationService.accept({ userId: revokedInviteeId }, created.token),
        ForbiddenException,
      );

      const accepted = await invitationService.accept(
        { userId: inviteeId },
        created.token,
      );
      assert.equal(accepted.tenantId, tenant.tenantId);
      assert.equal(accepted.role, "CASHIER");
      assert.ok(accepted.membershipId);

      await assert.rejects(
        invitationService.accept({ userId: inviteeId }, created.token),
        NotFoundException,
      );

      const membership = await owner.query<{
        role: string;
        status: string;
        invited_by_user_id: string;
      }>(
        "SELECT role, status, invited_by_user_id FROM tenant_memberships WHERE id = $1",
        [accepted.membershipId],
      );
      assert.deepEqual(membership.rows[0], {
        role: "CASHIER",
        status: "ACTIVE",
        invited_by_user_id: inviterId,
      });

      const revoked = await invitationService.create(
        { userId: inviterId },
        tenant.tenantId,
        {
          intendedIdentifier: "revoked@example.test",
          role: "VIEWER",
        },
      );
      assert.deepEqual(
        await invitationService.revoke(
          { userId: inviterId },
          tenant.tenantId,
          revoked.invitationId,
        ),
        { revoked: true },
      );
      await assert.rejects(
        invitationService.accept({ userId: revokedInviteeId }, revoked.token),
        NotFoundException,
      );

      const audit = await owner.query<{ action: string }>(
        "SELECT action FROM audit_events WHERE tenant_id = $1 ORDER BY occurred_at, id",
        [tenant.tenantId],
      );
      assert.deepEqual(
        audit.rows.map((row) => row.action).sort(),
        [
          "tenant.bootstrap",
          "tenant.invitation.create",
          "tenant.invitation.accept",
          "tenant.invitation.create",
          "tenant.invitation.revoke",
        ].sort(),
      );

      await assert.rejects(
        invitationService.create({ userId: inviteeId }, tenant.tenantId, {
          intendedIdentifier: "another@example.test",
          role: "VIEWER",
        }),
        ForbiddenException,
      );
    } finally {
      for (const tenantId of tenantIds) {
        await owner.query("DELETE FROM audit_events WHERE tenant_id = $1", [
          tenantId,
        ]);
        await owner.query("DELETE FROM stores WHERE tenant_id = $1", [
          tenantId,
        ]);
        await owner.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
      }
      await owner.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        [inviterId, inviteeId, revokedInviteeId],
      ]);
      await Promise.all([owner.end(), runtime.end()]);
    }
  },
);
