import { createHash, randomBytes } from "node:crypto";
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

export type TerminalStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";

export interface TerminalCommandResult {
  readonly terminalId: string;
  readonly storeId: string;
  readonly name: string;
  readonly status: TerminalStatus;
  readonly registeredAt: string;
  readonly revokedAt?: string | null;
}

export interface TerminalCredentialResult extends TerminalCommandResult {
  readonly credential: string;
}

export interface TerminalListItem extends TerminalCommandResult {
  readonly lastSeenAt: string | null;
}

interface TerminalRow {
  terminal_id: string;
  store_id: string;
  name: string;
  status: TerminalStatus;
  registered_at: string;
  revoked_at?: string | null;
}

function mapCommandError(error: unknown): never {
  if (
    error instanceof TenantAccessDeniedError ||
    error instanceof TenantPermissionDeniedError
  ) {
    throw new ForbiddenException("You cannot administer this terminal.");
  }

  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  if (code === "42501") {
    throw new ForbiddenException("You cannot administer this terminal.");
  }
  if (code === "55000" || code === "23505") {
    throw new ConflictException(
      "The terminal change conflicts with its current state.",
    );
  }
  if (code === "23503") {
    throw new NotFoundException("The store or terminal was not found.");
  }
  if (code === "22023") {
    throw new BadRequestException("Terminal command input is invalid.");
  }
  throw error;
}

function readRow(row: TerminalRow | undefined): TerminalCommandResult {
  if (!row) {
    throw new NotFoundException("An eligible terminal was not found.");
  }
  return {
    terminalId: row.terminal_id,
    storeId: row.store_id,
    name: row.name,
    status: row.status,
    registeredAt: row.registered_at,
    ...(row.revoked_at === undefined ? {} : { revokedAt: row.revoked_at }),
  };
}

function newCredential(): { raw: string; hash: Buffer } {
  const bytes = randomBytes(32);
  return {
    raw: bytes.toString("base64url"),
    hash: createHash("sha256").update(bytes).digest(),
  };
}

@Injectable()
export class TerminalService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async list(
    actor: AuthenticatedActor,
    tenantId: string,
    storeId: string,
  ): Promise<TerminalListItem[]> {
    try {
      const result = await this.database.withTenantPermission(
        actor,
        tenantId,
        "tenant:manage",
        async (client) =>
          client.query<{
            terminal_id: string;
            store_id: string;
            name: string;
            status: TerminalStatus;
            registered_at: string;
            last_seen_at: string | null;
            revoked_at: string | null;
          }>(
            `SELECT id AS terminal_id, store_id, name, status, registered_at,
                    last_seen_at, revoked_at
             FROM terminals
             WHERE tenant_id = $1 AND store_id = $2
             ORDER BY registered_at, id`,
            [tenantId, storeId],
          ),
      );
      return result.rows.map((row) => ({
        ...readRow(row),
        lastSeenAt: row.last_seen_at,
      }));
    } catch (error) {
      mapCommandError(error);
    }
  }

  async register(
    actor: AuthenticatedActor,
    tenantId: string,
    storeId: string,
    name: string,
  ): Promise<TerminalCredentialResult> {
    const normalizedName = name.trim();
    if (normalizedName.length < 1 || normalizedName.length > 120) {
      throw new BadRequestException("Terminal name has an invalid length.");
    }
    const credential = newCredential();

    try {
      const result = await this.database.withTenantPermission(
        actor,
        tenantId,
        "tenant:manage",
        async (client) =>
          client.query<TerminalRow>(
            "SELECT * FROM public.tenant_terminal_register($1, $2, $3, $4)",
            [tenantId, storeId, normalizedName, credential.hash],
          ),
      );
      return { ...readRow(result.rows[0]), credential: credential.raw };
    } catch (error) {
      mapCommandError(error);
    }
  }

  async rotateCredential(
    actor: AuthenticatedActor,
    tenantId: string,
    terminalId: string,
  ): Promise<TerminalCredentialResult> {
    const credential = newCredential();
    try {
      const result = await this.database.withTenantPermission(
        actor,
        tenantId,
        "tenant:manage",
        async (client) =>
          client.query<TerminalRow>(
            "SELECT * FROM public.tenant_terminal_rotate_credential($1, $2, $3)",
            [tenantId, terminalId, credential.hash],
          ),
      );
      return { ...readRow(result.rows[0]), credential: credential.raw };
    } catch (error) {
      mapCommandError(error);
    }
  }

  async suspend(
    actor: AuthenticatedActor,
    tenantId: string,
    terminalId: string,
  ): Promise<TerminalCommandResult> {
    try {
      const result = await this.database.withTenantPermission(
        actor,
        tenantId,
        "tenant:manage",
        async (client) =>
          client.query<TerminalRow>(
            "SELECT * FROM public.tenant_terminal_suspend($1, $2)",
            [tenantId, terminalId],
          ),
      );
      return readRow(result.rows[0]);
    } catch (error) {
      mapCommandError(error);
    }
  }

  async activate(
    actor: AuthenticatedActor,
    tenantId: string,
    terminalId: string,
  ): Promise<TerminalCommandResult> {
    try {
      const result = await this.database.withTenantPermission(
        actor,
        tenantId,
        "tenant:manage",
        async (client) =>
          client.query<TerminalRow>(
            "SELECT * FROM public.tenant_terminal_activate($1, $2)",
            [tenantId, terminalId],
          ),
      );
      return readRow(result.rows[0]);
    } catch (error) {
      mapCommandError(error);
    }
  }

  async revoke(
    actor: AuthenticatedActor,
    tenantId: string,
    terminalId: string,
  ): Promise<TerminalCommandResult> {
    try {
      const result = await this.database.withTenantPermission(
        actor,
        tenantId,
        "tenant:manage",
        async (client) =>
          client.query<TerminalRow>(
            "SELECT * FROM public.tenant_terminal_revoke($1, $2)",
            [tenantId, terminalId],
          ),
      );
      return readRow(result.rows[0]);
    } catch (error) {
      mapCommandError(error);
    }
  }
}
