import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DatabaseService,
  TenantAccessDeniedError,
  TenantPermissionDeniedError,
} from "../database/database.service";
import type { AuthenticatedActor } from "../database/database.service";
import type { TenantRole } from "./permissions";

export type MembershipStatus =
  | "INVITED"
  | "ACTIVE"
  | "SUSPENDED"
  | "REMOVED";

export type ChangeableMembershipRole = Exclude<TenantRole, "OWNER">;

export interface MembershipCommandResult {
  readonly membershipId: string;
  readonly userId: string;
  readonly role: TenantRole;
  readonly status: MembershipStatus;
}

const CHANGEABLE_ROLES = new Set<TenantRole>([
  "MANAGER",
  "CASHIER",
  "ACCOUNTANT",
  "VIEWER",
]);

function mapCommandError(error: unknown): never {
  if (
    error instanceof TenantAccessDeniedError ||
    error instanceof TenantPermissionDeniedError
  ) {
    throw new ForbiddenException("You cannot administer this membership.");
  }

  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  if (code === "42501") {
    throw new ForbiddenException("You cannot administer this membership.");
  }
  if (code === "55000" || code === "23505") {
    throw new ConflictException(
      "The membership change conflicts with the current tenant state.",
    );
  }
  if (code === "22023") {
    throw new BadRequestException("Membership command input is invalid.");
  }
  throw error;
}

@Injectable()
export class MembershipService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async changeRole(
    actor: AuthenticatedActor,
    tenantId: string,
    membershipId: string,
    newRole: ChangeableMembershipRole,
  ): Promise<MembershipCommandResult> {
    if (!CHANGEABLE_ROLES.has(newRole)) {
      throw new BadRequestException("OWNER cannot be assigned by this command.");
    }
    try {
      const result = await this.database.withTenantPermission(
        actor,
        tenantId,
        "members:manage",
        async (client) =>
          client.query<{
            membership_id: string;
            user_id: string;
            role: TenantRole;
            status: MembershipStatus;
          }>(
            "SELECT * FROM public.tenant_membership_change_role($1, $2, $3::tenant_role)",
            [tenantId, membershipId, newRole],
          ),
      );
      return this.readResult(result.rows[0]);
    } catch (error) {
      mapCommandError(error);
    }
  }

  async suspend(
    actor: AuthenticatedActor,
    tenantId: string,
    membershipId: string,
  ): Promise<MembershipCommandResult> {
    try {
      const result = await this.database.withTenantPermission(
        actor,
        tenantId,
        "members:manage",
        async (client) =>
          client.query<{
            membership_id: string;
            user_id: string;
            role: TenantRole;
            status: MembershipStatus;
          }>("SELECT * FROM public.tenant_membership_suspend($1, $2)", [
            tenantId,
            membershipId,
          ]),
      );
      return this.readResult(result.rows[0]);
    } catch (error) {
      mapCommandError(error);
    }
  }

  async remove(
    actor: AuthenticatedActor,
    tenantId: string,
    membershipId: string,
  ): Promise<MembershipCommandResult> {
    try {
      const result = await this.database.withTenantPermission(
        actor,
        tenantId,
        "members:manage",
        async (client) =>
          client.query<{
            membership_id: string;
            user_id: string;
            role: TenantRole;
            status: MembershipStatus;
          }>("SELECT * FROM public.tenant_membership_remove($1, $2)", [
            tenantId,
            membershipId,
          ]),
      );
      return this.readResult(result.rows[0]);
    } catch (error) {
      mapCommandError(error);
    }
  }

  private readResult(
    row:
      | {
          membership_id: string;
          user_id: string;
          role: TenantRole;
          status: MembershipStatus;
        }
      | undefined,
  ): MembershipCommandResult {
    if (!row) {
      throw new NotFoundException("An eligible tenant membership was not found.");
    }
    return {
      membershipId: row.membership_id,
      userId: row.user_id,
      role: row.role,
      status: row.status,
    };
  }
}
