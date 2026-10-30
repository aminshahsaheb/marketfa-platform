import { Inject, Injectable } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import type { PoolClient } from "pg";
import type { TenantRole } from "../tenancy/permissions";

export const DATABASE_POOL = Symbol("DATABASE_POOL");

export interface AuthenticatedActor {
  userId: string;
}

export interface ActiveMembership {
  tenantId: string;
  userId: string;
  role: TenantRole;
}

export class TenantAccessDeniedError extends Error {
  constructor() {
    super("The authenticated user has no active membership in this tenant.");
    this.name = "TenantAccessDeniedError";
  }
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async isReady(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  async withTenant<T>(
    actor: AuthenticatedActor,
    tenantId: string,
    operation: (
      client: PoolClient,
      membership: ActiveMembership
    ) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    let transactionStarted = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;
      await client.query("SET LOCAL ROLE marketfa_app");
      await client.query(
        "SELECT set_config('app.current_user_id', $1, true)",
        [actor.userId]
      );

      const membershipResult = await client.query<{
        role: TenantRole;
      }>(
        `SELECT role
         FROM tenant_memberships
         WHERE tenant_id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
        [tenantId, actor.userId]
      );

      const membership = membershipResult.rows[0];
      if (!membership) {
        throw new TenantAccessDeniedError();
      }

      await client.query(
        "SELECT set_config('app.current_tenant_id', $1, true)",
        [tenantId]
      );

      const tenantResult = await client.query<{ status: string }>(
        "SELECT status FROM tenants WHERE id = $1",
        [tenantId]
      );

      if (tenantResult.rows[0]?.status !== "ACTIVE") {
        throw new TenantAccessDeniedError();
      }

      const result = await operation(client, {
        tenantId,
        userId: actor.userId,
        role: membership.role
      });

      await client.query("COMMIT");
      transactionStarted = false;
      return result;
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
