import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { Pool } from "pg";
import test from "node:test";
import { runMigrations } from "../scripts/migrate";
import {
  DatabaseService,
  TenantAccessDeniedError,
} from "../src/database/database.service";
import { InvitationService } from "../src/tenancy/invitation.service";
import { MembershipService } from "../src/tenancy/membership.service";
import { TenantBootstrapService } from "../src/tenancy/tenant-bootstrap.service";

const migrationUrl = process.env.DATABASE_URL_MIGRATION;
const runtimeUrl = process.env.DATABASE_URL;
const enabled = Boolean(migrationUrl && runtimeUrl);

test(
  "membership lifecycle changes roles, suspends/removes access, audits, and protects the last OWNER",
  { skip: !enabled },
  async () => {
    await runMigrations();
    const owner = new Pool({ connectionString: migrationUrl, max: 1 });
    const runtime = new Pool({ connectionString: runtimeUrl, max: 6 });
    const ownerAId = randomUUID();
    const ownerBId = randomUUID();
    const managerId = randomUUID();
    const cashierId = randomUUID();
    const tenantIds: string[] = [];

    try {
      await owner.query(
        "INSERT INTO users (id, display_name, status) VALUES ($1, 'Owner A', 'ACTIVE'), ($2, 'Owner B', 'ACTIVE'), ($3, 'Manager', 'ACTIVE'), ($4, 'Cashier', 'ACTIVE')",
        [ownerAId, ownerBId, managerId, cashierId],
      );
      await owner.query(
        "INSERT INTO auth_identities (user_id, provider_key, provider_subject, normalized_identifier, verified_at) VALUES ($1, 'test', $2, $2, now()), ($3, 'test', $4, $4, now())",
        [managerId, "manager@example.test", cashierId, "cashier@example.test"],
      );

      const database = new DatabaseService(runtime);
      const bootstrap = new TenantBootstrapService(database);
      const memberships = new MembershipService(database);
      const invitations = new InvitationService(database);
      const tenant = await bootstrap.create(
        { userId: ownerAId },
        {
          displayName: "Membership Test",
          legalName: null,
          storeName: "Main Store",
          industryId: "general-retail",
        },
      );
      tenantIds.push(tenant.tenantId);

      const extra = await owner.query<{
        id: string;
        user_id: string;
        role: string;
        status: string;
      }>(
        "INSERT INTO tenant_memberships (tenant_id, user_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE'), ($1, $3, 'MANAGER', 'ACTIVE'), ($1, $4, 'CASHIER', 'ACTIVE') RETURNING id, user_id, role, status",
        [tenant.tenantId, ownerBId, managerId, cashierId],
      );
      const ownerBMembership = extra.rows.find(
        (row) => row.user_id === ownerBId,
      );
      const managerMembership = extra.rows.find(
        (row) => row.user_id === managerId,
      );
      const cashierMembership = extra.rows.find(
        (row) => row.user_id === cashierId,
      );
      assert.ok(ownerBMembership && managerMembership && cashierMembership);

      const changed = await memberships.changeRole(
        { userId: ownerAId },
        tenant.tenantId,
        managerMembership.id,
        "ACCOUNTANT",
      );
      assert.equal(changed.role, "ACCOUNTANT");
      assert.equal(changed.status, "ACTIVE");

      await assert.rejects(
        memberships.changeRole(
          { userId: managerId },
          tenant.tenantId,
          cashierMembership.id,
          "VIEWER",
        ),
        ForbiddenException,
      );

      await assert.rejects(
        memberships.changeRole(
          { userId: ownerAId },
          tenant.tenantId,
          tenant.ownerMembershipId,
          "MANAGER",
        ),
        ForbiddenException,
      );

      const suspended = await memberships.suspend(
        { userId: ownerAId },
        tenant.tenantId,
        cashierMembership.id,
      );
      assert.equal(suspended.status, "SUSPENDED");
      await assert.rejects(
        database.withTenantPermission(
          { userId: cashierId },
          tenant.tenantId,
          "catalog:read",
          async () => "should not run",
        ),
        TenantAccessDeniedError,
      );
      await assert.rejects(
        invitations.create({ userId: ownerAId }, tenant.tenantId, {
          intendedIdentifier: "cashier@example.test",
          role: "VIEWER",
        }),
        ConflictException,
      );

      const removed = await memberships.remove(
        { userId: ownerAId },
        tenant.tenantId,
        managerMembership.id,
      );
      assert.equal(removed.status, "REMOVED");
      await assert.rejects(
        database.withTenantPermission(
          { userId: managerId },
          tenant.tenantId,
          "catalog:read",
          async () => "should not run",
        ),
        TenantAccessDeniedError,
      );

      await assert.rejects(
        invitations.create({ userId: ownerAId }, tenant.tenantId, {
          intendedIdentifier: "manager@example.test",
          role: "VIEWER",
        }),
        ConflictException,
      );

      const concurrent = await Promise.allSettled([
        memberships.suspend(
          { userId: ownerAId },
          tenant.tenantId,
          ownerBMembership.id,
        ),
        memberships.remove(
          { userId: ownerBId },
          tenant.tenantId,
          tenant.ownerMembershipId,
        ),
      ]);
      assert.equal(
        concurrent.filter((result) => result.status === "fulfilled").length,
        1,
      );

      const activeOwners = await owner.query<{
        id: string;
        user_id: string;
      }>(
        "SELECT id, user_id FROM tenant_memberships WHERE tenant_id = $1 AND role = 'OWNER' AND status = 'ACTIVE'",
        [tenant.tenantId],
      );
      assert.equal(activeOwners.rows.length, 1);
      const remainingOwner = activeOwners.rows[0];
      assert.ok(remainingOwner);

      await assert.rejects(
        memberships.suspend(
          { userId: remainingOwner.user_id },
          tenant.tenantId,
          remainingOwner.id,
        ),
        ConflictException,
      );
      await assert.rejects(
        memberships.remove(
          { userId: remainingOwner.user_id },
          tenant.tenantId,
          remainingOwner.id,
        ),
        ConflictException,
      );

      const audit = await owner.query<{ action: string }>(
        "SELECT action FROM audit_events WHERE tenant_id = $1",
        [tenant.tenantId],
      );
      const auditActions = audit.rows.map((row) => row.action);
      assert.equal(auditActions.length, 5);
      assert.equal(
        auditActions.filter((action) => action === "tenant.bootstrap").length,
        1,
      );
      assert.equal(
        auditActions.filter(
          (action) => action === "tenant.membership.role_change",
        ).length,
        1,
      );
      assert.equal(
        auditActions.filter((action) => action === "tenant.membership.suspend")
          .length +
          auditActions.filter((action) => action === "tenant.membership.remove")
            .length,
        3,
      );
      assert.equal(
        auditActions.filter((action) => action === "tenant.membership.suspend")
          .length,
        1 +
          concurrent.filter(
            (result) =>
              result.status === "fulfilled" &&
              result.value.status === "SUSPENDED",
          ).length,
      );
      assert.equal(
        auditActions.filter((action) => action === "tenant.membership.remove")
          .length,
        1 +
          concurrent.filter(
            (result) =>
              result.status === "fulfilled" &&
              result.value.status === "REMOVED",
          ).length,
      );
    } finally {
      for (const tenantId of tenantIds) {
        await owner.query("DELETE FROM audit_events WHERE tenant_id = $1", [
          tenantId,
        ]);
        await owner.query(
          "DELETE FROM tenant_invitations WHERE tenant_id = $1",
          [tenantId],
        );
        await owner.query("DELETE FROM stores WHERE tenant_id = $1", [
          tenantId,
        ]);
        await owner.query(
          "DELETE FROM business_profile_capabilities WHERE tenant_id = $1",
          [tenantId],
        );
        await owner.query(
          "DELETE FROM business_profiles WHERE tenant_id = $1",
          [tenantId],
        );
        await owner.query(
          "DELETE FROM tenant_memberships WHERE tenant_id = $1 AND user_id <> $2",
          [tenantId, ownerAId],
        );
        await owner.query(
          "DELETE FROM tenant_memberships WHERE tenant_id = $1",
          [tenantId],
        );
        await owner.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
      }
      await owner.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        [ownerAId, ownerBId, managerId, cashierId],
      ]);
      await Promise.all([owner.end(), runtime.end()]);
    }
  },
);
