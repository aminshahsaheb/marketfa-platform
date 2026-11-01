import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Pool } from "pg";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { runMigrations } from "../scripts/migrate";
import { AppModule } from "../src/app.module";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, SESSION_COOKIE_NAME } from "../src/auth/auth.constants";
import { DatabaseService } from "../src/database/database.service";
import { SessionService } from "../src/sessions/session.service";
import { TenantBootstrapService } from "../src/tenancy/tenant-bootstrap.service";

const migrationUrl = process.env.DATABASE_URL_MIGRATION;
const runtimeUrl = process.env.DATABASE_URL;
const authRuntimeUrl = process.env.AUTH_DATABASE_URL;
const enabled = Boolean(migrationUrl && runtimeUrl && authRuntimeUrl);

const roles = [
  "owner",
  "manager",
  "cashier",
  "accountant",
  "viewer",
  "invitee",
  "outsider",
] as const;
type RoleKey = (typeof roles)[number];

test(
  "HTTP authorization matrix enforces sessions, CSRF, tenant roles, membership state, and invitation identity",
  { skip: !enabled },
  async () => {
    await runMigrations();
    const ownerDb = new Pool({ connectionString: migrationUrl, max: 1 });
    const runtimeDb = new Pool({ connectionString: runtimeUrl, max: 6 });
    const authDb = new Pool({ connectionString: authRuntimeUrl, max: 2 });
    const userIds = Object.fromEntries(
      roles.map((role) => [role, randomUUID()]),
    ) as Record<RoleKey, string>;
    const identityIds = Object.fromEntries(
      roles.map((role) => [role, randomUUID()]),
    ) as Record<RoleKey, string>;
    const tenantIds: string[] = [];
    const sessionTokens = new Map<RoleKey, string>();
    let app: INestApplication | undefined;
    const previousTrustedOrigins = process.env.CSRF_TRUSTED_ORIGINS;

    try {
      for (const role of roles) {
        const email = `${role}@auth-matrix.example.test`;
        await ownerDb.query(
          "INSERT INTO users (id, display_name, status) VALUES ($1, $2, 'ACTIVE')",
          [userIds[role], `Auth Matrix ${role}`],
        );
        await ownerDb.query(
          `INSERT INTO auth_identities
            (id, user_id, provider_key, provider_subject, normalized_identifier, verified_at)
           VALUES ($1, $2, 'matrix-provider', $3, $4, now())`,
          [identityIds[role], userIds[role], role, email],
        );
      }

      const sessions = new SessionService(runtimeDb, authDb);
      for (const role of roles) {
        const issued = await sessions.create(identityIds[role], `matrix-${role}`);
        sessionTokens.set(role, issued.token);
      }

      const bootstrap = new TenantBootstrapService(new DatabaseService(runtimeDb));
      const tenant = await bootstrap.create(
        { userId: userIds.owner },
        {
          displayName: "Authorization Matrix",
          legalName: null,
          storeName: "Matrix Store",
        },
      );
      tenantIds.push(tenant.tenantId);

      const membershipRoles = [
        ["manager", "MANAGER"],
        ["cashier", "CASHIER"],
        ["accountant", "ACCOUNTANT"],
        ["viewer", "VIEWER"],
      ] as const;
      for (const [roleKey, role] of membershipRoles) {
        await ownerDb.query(
          "INSERT INTO tenant_memberships (tenant_id, user_id, role, status) VALUES ($1, $2, $3, 'ACTIVE')",
          [tenant.tenantId, userIds[roleKey], role],
        );
      }

      const memberships = await ownerDb.query<{
        id: string;
        user_id: string;
        role: string;
      }>(
        "SELECT id, user_id, role FROM tenant_memberships WHERE tenant_id = $1",
        [tenant.tenantId],
      );
      const membershipByRole = new Map(
        memberships.rows.map((row) => [row.role, row.id]),
      );
      const viewerMembershipId = membershipByRole.get("VIEWER");
      const cashierMembershipId = membershipByRole.get("CASHIER");
      const accountantMembershipId = membershipByRole.get("ACCOUNTANT");
      const managerMembershipId = membershipByRole.get("MANAGER");
      assert.ok(viewerMembershipId);
      assert.ok(cashierMembershipId);
      assert.ok(accountantMembershipId);
      assert.ok(managerMembershipId);

      app = await NestFactory.create(AppModule, { logger: false });
      app.setGlobalPrefix("api/v1");
      await app.listen(0, "127.0.0.1");
      const address = app.getHttpServer().address() as AddressInfo | null;
      assert.ok(address && typeof address !== "string");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const origin = baseUrl;
      process.env.CSRF_TRUSTED_ORIGINS = origin;

      const csrfResponse = await fetch(`${baseUrl}/api/v1/auth/csrf`);
      assert.equal(csrfResponse.status, 200);
      const setCookie = csrfResponse.headers.get("set-cookie");
      assert.ok(setCookie);
      const csrfToken = setCookie.split(";")[0]?.split("=")[1];
      assert.ok(csrfToken);

      async function request(
        role: RoleKey | null,
        method: string,
        path: string,
        body?: unknown,
        includeCsrf = true,
      ): Promise<Response> {
        const headers: Record<string, string> = {};
        const cookies: string[] = [];
        const token = role === null ? undefined : sessionTokens.get(role);
        if (token) cookies.push(`${SESSION_COOKIE_NAME}=${token}`);
        if (includeCsrf) cookies.push(`${CSRF_COOKIE_NAME}=${csrfToken}`);
        if (cookies.length > 0) headers.cookie = cookies.join("; ");
        if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
          headers.origin = origin;
          if (includeCsrf) headers[CSRF_HEADER_NAME] = csrfToken;
        }
        if (body !== undefined) headers["content-type"] = "application/json";
        return fetch(`${baseUrl}${path}`, {
          method,
          headers,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      }

      const tenantPath = `/api/v1/tenants/${tenant.tenantId}`;
      const terminalListPath = `${tenantPath}/stores/${tenant.storeId}/terminals`;

      assert.equal(
        (await fetch(`${baseUrl}/api/v1/health/live`)).status,
        200,
      );
      assert.equal((await request(null, "GET", terminalListPath)).status, 401);
      assert.equal(
        (
          await fetch(`${baseUrl}${terminalListPath}`, {
            headers: { cookie: `${SESSION_COOKIE_NAME}=invalid-token` },
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await request(
            "owner",
            "POST",
            `${tenantPath}/invitations`,
            { intendedIdentifier: "csrf-denied@example.test", role: "VIEWER" },
            false,
          )
        ).status,
        403,
      );

      const bootstrapResponse = await request("outsider", "POST", "/api/v1/tenants", {
        displayName: "Outsider Tenant",
        legalName: null,
        storeName: "Outsider Store",
      });
      assert.equal(bootstrapResponse.status, 201);
      const outsiderTenant = (await bootstrapResponse.json()) as {
        tenantId: string;
        storeId: string;
      };
      tenantIds.push(outsiderTenant.tenantId);
      assert.equal(
        (
          await request(
            "outsider",
            "GET",
            `/api/v1/tenants/${outsiderTenant.tenantId}/stores/${outsiderTenant.storeId}/terminals`,
          )
        ).status,
        200,
      );
      assert.equal(
        (await request("outsider", "GET", terminalListPath)).status,
        403,
      );

      const pendingResponse = await request(
        "owner",
        "POST",
        `${tenantPath}/invitations`,
        { intendedIdentifier: "revoke-me@example.test", role: "VIEWER" },
      );
      assert.equal(pendingResponse.status, 201);
      const pendingInvitation = (await pendingResponse.json()) as {
        invitationId: string;
      };

      for (const role of roles.filter((value) => value !== "owner")) {
        assert.equal(
          (
            await request(role, "POST", `${tenantPath}/invitations`, {
              intendedIdentifier: `${role}-denied@example.test`,
              role: "VIEWER",
            })
          ).status,
          403,
          `${role} must not create invitations`,
        );
        assert.equal(
          (
            await request(
              role,
              "DELETE",
              `${tenantPath}/invitations/${pendingInvitation.invitationId}`,
            )
          ).status,
          403,
          `${role} must not revoke invitations`,
        );
      }
      assert.equal(
        (
          await request(
            "owner",
            "DELETE",
            `${tenantPath}/invitations/${pendingInvitation.invitationId}`,
          )
        ).status,
        200,
      );

      const acceptanceInviteResponse = await request(
        "owner",
        "POST",
        `${tenantPath}/invitations`,
        { intendedIdentifier: "invitee@auth-matrix.example.test", role: "CASHIER" },
      );
      assert.equal(acceptanceInviteResponse.status, 201);
      const acceptanceInvite = (await acceptanceInviteResponse.json()) as {
        token: string;
      };
      for (const role of roles.filter((value) => value !== "invitee")) {
        assert.equal(
          (
            await request("owner", "POST", "/api/v1/invitations/accept", {
              token: acceptanceInvite.token,
            })
          ).status,
          403,
          `${role} identity mismatch must not accept the invitation`,
        );
      }
      const accepted = await request("invitee", "POST", "/api/v1/invitations/accept", {
        token: acceptanceInvite.token,
      });
      assert.equal(accepted.status, 201);

      const roleChangePath = `${tenantPath}/memberships/${viewerMembershipId}/role`;
      const suspendMembershipPath = `${tenantPath}/memberships/${viewerMembershipId}/suspend`;
      const removeMembershipPath = `${tenantPath}/memberships/${cashierMembershipId}`;
      for (const role of roles.filter((value) => value !== "owner")) {
        assert.equal(
          (await request(role, "PATCH", roleChangePath, { role: "ACCOUNTANT" })).status,
          403,
          `${role} must not change membership roles`,
        );
        assert.equal(
          (await request(role, "POST", suspendMembershipPath)).status,
          403,
          `${role} must not suspend memberships`,
        );
        assert.equal(
          (await request(role, "DELETE", removeMembershipPath)).status,
          403,
          `${role} must not remove memberships`,
        );
      }
      assert.equal(
        (await request("owner", "PATCH", roleChangePath, { role: "ACCOUNTANT" })).status,
        200,
      );
      assert.equal((await request("owner", "POST", suspendMembershipPath)).status, 201);
      assert.equal((await request("owner", "DELETE", removeMembershipPath)).status, 200);

      const registerPath = `${tenantPath}/stores/${tenant.storeId}/terminals`;
      const registered = await request("owner", "POST", registerPath, {
        name: "HTTP Matrix POS",
      });
      assert.equal(registered.status, 201);
      const terminal = (await registered.json()) as {
        terminalId: string;
        credential: string;
      };
      assert.equal(typeof terminal.credential, "string");
      const credentialPath = `${tenantPath}/terminals/${terminal.terminalId}/credential`;
      const suspendTerminalPath = `${tenantPath}/terminals/${terminal.terminalId}/suspend`;
      const activateTerminalPath = `${tenantPath}/terminals/${terminal.terminalId}/activate`;
      const revokeTerminalPath = `${tenantPath}/terminals/${terminal.terminalId}`;

      for (const role of roles.filter((value) => value !== "owner")) {
        assert.equal((await request(role, "GET", terminalListPath)).status, 403);
        assert.equal(
          (await request(role, "POST", registerPath, { name: `${role} POS` })).status,
          403,
        );
        assert.equal((await request(role, "POST", credentialPath)).status, 403);
        assert.equal((await request(role, "POST", suspendTerminalPath)).status, 403);
        assert.equal((await request(role, "POST", activateTerminalPath)).status, 403);
        assert.equal((await request(role, "DELETE", revokeTerminalPath)).status, 403);
      }

      assert.equal((await request("owner", "GET", terminalListPath)).status, 200);
      assert.equal((await request("owner", "POST", credentialPath)).status, 201);
      assert.equal((await request("owner", "POST", suspendTerminalPath)).status, 201);
      assert.equal((await request("owner", "POST", activateTerminalPath)).status, 201);
      assert.equal((await request("owner", "DELETE", revokeTerminalPath)).status, 200);

      assert.equal(
        (
          await request(
            "owner",
            "POST",
            `${tenantPath}/memberships/${managerMembershipId}/suspend`,
          )
        ).status,
        201,
      );
      assert.equal(
        (await request("manager", "GET", terminalListPath)).status,
        403,
        "suspended membership must lose access immediately",
      );
      assert.equal(
        (
          await request(
            "owner",
            "DELETE",
            `${tenantPath}/memberships/${accountantMembershipId}`,
          )
        ).status,
        200,
      );
      assert.equal(
        (await request("accountant", "GET", terminalListPath)).status,
        403,
        "removed membership must lose access immediately",
      );
      assert.equal(
        (await request("viewer", "GET", terminalListPath)).status,
        403,
        "suspended membership must lose access immediately",
      );
    } finally {
      if (app) await app.close();
      if (previousTrustedOrigins === undefined) {
        delete process.env.CSRF_TRUSTED_ORIGINS;
      } else {
        process.env.CSRF_TRUSTED_ORIGINS = previousTrustedOrigins;
      }
      for (const tenantId of tenantIds) {
        await ownerDb.query("DELETE FROM audit_events WHERE tenant_id = $1", [
          tenantId,
        ]);
        await ownerDb.query(
          "DELETE FROM terminal_assignments WHERE tenant_id = $1",
          [tenantId],
        );
        await ownerDb.query("DELETE FROM terminals WHERE tenant_id = $1", [
          tenantId,
        ]);
        await ownerDb.query("DELETE FROM tenant_invitations WHERE tenant_id = $1", [
          tenantId,
        ]);
        await ownerDb.query(
          "DELETE FROM tenant_memberships WHERE tenant_id = $1",
          [tenantId],
        );
        await ownerDb.query("DELETE FROM stores WHERE tenant_id = $1", [
          tenantId,
        ]);
        await ownerDb.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
      }
      await ownerDb.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        Object.values(userIds),
      ]);
      await Promise.all([ownerDb.end(), runtimeDb.end(), authDb.end()]);
    }
  },
);
