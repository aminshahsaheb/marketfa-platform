import { createHash, randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type { AuthenticatedActor } from "../database/database.service";
import type { TenantRole } from "./permissions";

export type InviteableRole = Exclude<TenantRole, "OWNER">;

export interface CreateInvitationInput {
  readonly intendedIdentifier: string;
  readonly role: InviteableRole;
  readonly ttlSeconds?: number;
}

export interface CreatedInvitation {
  readonly invitationId: string;
  readonly token: string;
  readonly expiresAt: string;
  readonly role: InviteableRole;
  readonly intendedIdentifier: string;
}

const INVITEABLE_ROLES = new Set<TenantRole>([
  "MANAGER",
  "CASHIER",
  "ACCOUNTANT",
  "VIEWER",
]);

function parseInviteToken(token: unknown): Buffer {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new BadRequestException("Invitation token is invalid.");
  }
  const bytes = Buffer.from(token, "base64url");
  if (bytes.length !== 32 || bytes.toString("base64url") !== token) {
    throw new BadRequestException("Invitation token is invalid.");
  }
  return createHash("sha256").update(bytes).digest();
}

function mapCommandError(error: unknown): never {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  if (code === "42501") {
    throw new ForbiddenException("You cannot perform this invitation action.");
  }
  if (code === "23505") {
    throw new ConflictException(
      "A membership or pending invitation already exists.",
    );
  }
  if (code === "22023") {
    throw new BadRequestException("Invitation input is invalid.");
  }
  throw error;
}

@Injectable()
export class InvitationService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async create(
    actor: AuthenticatedActor,
    tenantId: string,
    input: CreateInvitationInput,
  ): Promise<CreatedInvitation> {
    const identifier = input.intendedIdentifier.trim().toLowerCase();
    if (
      identifier.length < 3 ||
      identifier.length > 320 ||
      !INVITEABLE_ROLES.has(input.role)
    ) {
      throw new BadRequestException("Invitation input is invalid.");
    }
    const ttlSeconds = input.ttlSeconds ?? 604800;
    if (
      !Number.isInteger(ttlSeconds) ||
      ttlSeconds < 3600 ||
      ttlSeconds > 2592000
    ) {
      throw new BadRequestException(
        "Invitation expiry must be 1 hour to 30 days.",
      );
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256")
      .update(Buffer.from(token, "base64url"))
      .digest();

    try {
      const result = await this.database.withTenantPermission(
        actor,
        tenantId,
        "members:manage",
        async (client) =>
          client.query<{ invitation_id: string; expires_at: Date | string }>(
            "SELECT * FROM public.tenant_invitation_create($1, $2, $3, $4::tenant_role, $5)",
            [tenantId, tokenHash, identifier, input.role, ttlSeconds],
          ),
      );
      const row = result.rows[0];
      if (!row) {
        throw new ConflictException("Invitation could not be created.");
      }
      return {
        invitationId: row.invitation_id,
        token,
        expiresAt:
          row.expires_at instanceof Date
            ? row.expires_at.toISOString()
            : new Date(row.expires_at).toISOString(),
        role: input.role,
        intendedIdentifier: identifier,
      };
    } catch (error) {
      mapCommandError(error);
    }
  }

  async revoke(
    actor: AuthenticatedActor,
    tenantId: string,
    invitationId: string,
  ): Promise<{ revoked: boolean }> {
    try {
      const result = await this.database.withTenantPermission(
        actor,
        tenantId,
        "members:manage",
        async (client) =>
          client.query<{ revoked: boolean }>(
            "SELECT public.tenant_invitation_revoke($1, $2) AS revoked",
            [tenantId, invitationId],
          ),
      );
      const revoked = result.rows[0]?.revoked ?? false;
      if (!revoked) {
        throw new NotFoundException("Pending invitation was not found.");
      }
      return { revoked };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      mapCommandError(error);
    }
  }

  async accept(
    actor: AuthenticatedActor,
    token: unknown,
  ): Promise<{ tenantId: string; membershipId: string; role: TenantRole }> {
    const tokenHash = parseInviteToken(token);
    try {
      const result = await this.database.withAuthenticatedActor(
        actor,
        async (client) =>
          client.query<{
            tenant_id: string;
            membership_id: string;
            role: TenantRole;
          }>("SELECT * FROM public.tenant_invitation_accept($1)", [tokenHash]),
      );
      const row = result.rows[0];
      if (!row) {
        throw new NotFoundException(
          "Invitation is invalid, expired, or already used.",
        );
      }
      return {
        tenantId: row.tenant_id,
        membershipId: row.membership_id,
        role: row.role,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      mapCommandError(error);
    }
  }
}
