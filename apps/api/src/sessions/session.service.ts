import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import type { Pool } from "pg";
import { DATABASE_POOL } from "../database/database.service";

export const AUTH_DATABASE_POOL = Symbol("AUTH_DATABASE_POOL");

const SESSION_TOKEN_BYTES = 32;
const SESSION_ABSOLUTE_TTL_SECONDS = 30 * 24 * 60 * 60;
const SESSION_IDLE_TTL_SECONDS = 7 * 24 * 60 * 60;

interface SessionRow {
  session_id: string;
  user_id: string;
  expires_at: Date | string;
}

export interface VerifiedAuthIdentity {
  readonly identityId: string;
  readonly userId: string;
}

export interface IssuedSession {
  readonly sessionId: string;
  readonly userId: string;
  readonly token: string;
  readonly expiresAt: string;
}

export interface ResolvedSession {
  readonly sessionId: string;
  readonly userId: string;
  readonly expiresAt: string;
}

export class SessionCreationDeniedError extends Error {
  constructor() {
    super("A session could not be created for this account.");
    this.name = "SessionCreationDeniedError";
  }
}

@Injectable()
export class SessionService implements OnModuleDestroy {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    @Inject(AUTH_DATABASE_POOL) private readonly authPool: Pool,
  ) {}

  async resolveVerifiedIdentity(
    providerKey: string,
    providerSubject: string,
  ): Promise<VerifiedAuthIdentity | null> {
    if (
      !providerKey ||
      providerKey.length > 128 ||
      !providerSubject ||
      providerSubject.length > 512
    ) {
      return null;
    }

    const result = await this.authPool.query<{
      identity_id: string;
      user_id: string;
    }>("SELECT * FROM public.auth_resolve_identity($1, $2)", [
      providerKey,
      providerSubject,
    ]);
    const identity = result.rows[0];

    return identity
      ? { identityId: identity.identity_id, userId: identity.user_id }
      : null;
  }

  async create(
    authIdentityId: string,
    userAgent?: string,
  ): Promise<IssuedSession> {
    const token = randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
    const tokenHash = this.hashToken(token);

    const result = await this.authPool.query<SessionRow>(
      "SELECT * FROM public.auth_create_session($1, $2, $3, $4)",
      [
        authIdentityId,
        tokenHash,
        SESSION_ABSOLUTE_TTL_SECONDS,
        this.normalizeUserAgent(userAgent),
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new SessionCreationDeniedError();
    }

    return {
      sessionId: row.session_id,
      userId: row.user_id,
      token,
      expiresAt: this.toIsoString(row.expires_at),
    };
  }

  async resolve(token: unknown): Promise<ResolvedSession | null> {
    const tokenHash = this.parseAndHashToken(token);
    if (!tokenHash) {
      return null;
    }

    const result = await this.pool.query<SessionRow>(
      "SELECT * FROM public.auth_resolve_session($1, $2)",
      [tokenHash, SESSION_IDLE_TTL_SECONDS],
    );
    const row = result.rows[0];

    return row
      ? {
          sessionId: row.session_id,
          userId: row.user_id,
          expiresAt: this.toIsoString(row.expires_at),
        }
      : null;
  }

  async rotate(
    token: unknown,
    userAgent?: string,
  ): Promise<IssuedSession | null> {
    const oldTokenHash = this.parseAndHashToken(token);
    if (!oldTokenHash) {
      return null;
    }

    const newToken = randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
    const newTokenHash = this.hashToken(newToken);
    const result = await this.pool.query<SessionRow>(
      "SELECT * FROM public.auth_rotate_session($1, $2, $3, $4)",
      [
        oldTokenHash,
        newTokenHash,
        SESSION_ABSOLUTE_TTL_SECONDS,
        this.normalizeUserAgent(userAgent),
      ],
    );
    const row = result.rows[0];

    return row
      ? {
          sessionId: row.session_id,
          userId: row.user_id,
          token: newToken,
          expiresAt: this.toIsoString(row.expires_at),
        }
      : null;
  }

  async revoke(token: unknown): Promise<boolean> {
    const tokenHash = this.parseAndHashToken(token);
    if (!tokenHash) {
      return false;
    }

    const result = await this.pool.query<{ revoked: boolean }>(
      "SELECT public.auth_revoke_session($1) AS revoked",
      [tokenHash],
    );

    return result.rows[0]?.revoked ?? false;
  }

  async onModuleDestroy(): Promise<void> {
    await this.authPool.end();
  }

  private parseAndHashToken(token: unknown): Buffer | null {
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return null;
    }

    const bytes = Buffer.from(token, "base64url");
    if (
      bytes.length !== SESSION_TOKEN_BYTES ||
      bytes.toString("base64url") !== token
    ) {
      return null;
    }

    return this.hashTokenBytes(bytes);
  }

  private hashToken(token: string): Buffer {
    return this.hashTokenBytes(Buffer.from(token, "base64url"));
  }

  private hashTokenBytes(token: Buffer): Buffer {
    return createHash("sha256").update(token).digest();
  }

  private normalizeUserAgent(value?: string): string | null {
    if (!value) {
      return null;
    }

    return Array.from(value)
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code >= 0x20 && code !== 0x7f;
      })
      .join("")
      .slice(0, 256);
  }

  private toIsoString(value: Date | string): string {
    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }
}
