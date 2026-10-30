import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import test from "node:test";
import { runMigrations } from "../scripts/migrate";
import { SessionService } from "../src/sessions/session.service";

const migrationUrl = process.env.DATABASE_URL_MIGRATION;
const runtimeUrl = process.env.DATABASE_URL;
const authRuntimeUrl = process.env.AUTH_DATABASE_URL;
const enabled = Boolean(migrationUrl && runtimeUrl && authRuntimeUrl);

test(
  "provider-neutral sessions are hashed, resolved, rotated, idled, and revoked",
  { skip: !enabled },
  async () => {
    await runMigrations();
    const owner = new Pool({ connectionString: migrationUrl, max: 1 });
    const runtime = new Pool({ connectionString: runtimeUrl, max: 4 });
    const authRuntime = new Pool({ connectionString: authRuntimeUrl, max: 2 });
    const userId = randomUUID();
    const verifiedIdentityId = randomUUID();
    const unverifiedIdentityId = randomUUID();
    const sessions = new SessionService(runtime, authRuntime);

    try {
      await owner.query(
        "INSERT INTO users (id, display_name) VALUES ($1, $2)",
        [userId, "Session Test User"],
      );
      await owner.query(
        `INSERT INTO auth_identities
          (id, user_id, provider_key, provider_subject, normalized_identifier, verified_at)
         VALUES
          ($1, $2, 'test-provider', 'verified-subject', 'verified@example.test', now()),
          ($3, $2, 'test-provider', 'unverified-subject', 'unverified@example.test', NULL)`,
        [verifiedIdentityId, userId, unverifiedIdentityId],
      );

      await assert.rejects(
        runtime.query("SELECT id FROM user_sessions LIMIT 1"),
      );
      await assert.rejects(
        authRuntime.query("SELECT id FROM user_sessions LIMIT 1"),
      );
      await assert.rejects(
        authRuntime.query("SELECT id FROM auth_identities LIMIT 1"),
      );
      await assert.rejects(
        authRuntime.query("SELECT * FROM public.auth_resolve_session($1, $2)", [
          randomBytes(32),
          604800,
        ]),
      );
      await assert.rejects(
        runtime.query("SELECT * FROM public.auth_resolve_identity($1, $2)", [
          "test-provider",
          "verified-subject",
        ]),
      );
      await assert.rejects(
        runtime.query(
          "SELECT * FROM public.auth_create_session($1, $2, $3, $4)",
          [verifiedIdentityId, randomBytes(32), 3600, null],
        ),
      );
      assert.equal(await sessions.resolve("not-a-session-token"), null);
      assert.equal(await sessions.resolve(null), null);
      assert.equal(await sessions.resolve(["not", "a", "token"]), null);
      assert.equal(await sessions.revoke(null), false);

      const verifiedIdentity = await sessions.resolveVerifiedIdentity(
        "test-provider",
        "verified-subject",
      );
      assert.deepEqual(verifiedIdentity, {
        identityId: verifiedIdentityId,
        userId,
      });
      assert.ok(verifiedIdentity);
      assert.equal(
        await sessions.resolveVerifiedIdentity(
          "test-provider",
          "unverified-subject",
        ),
        null,
      );
      assert.equal(
        await sessions.resolveVerifiedIdentity("unknown-provider", "missing"),
        null,
      );
      await assert.rejects(sessions.create(unverifiedIdentityId));
      const issued = await sessions.create(
        verifiedIdentity.identityId,
        "MarketFa test agent",
      );
      assert.match(issued.token, /^[A-Za-z0-9_-]{43}$/);

      const expectedHash = createHash("sha256")
        .update(Buffer.from(issued.token, "base64url"))
        .digest();
      const stored = await owner.query<{
        token_hash: Buffer;
        user_agent: string | null;
      }>("SELECT token_hash, user_agent FROM user_sessions WHERE id = $1", [
        issued.sessionId,
      ]);
      assert.deepEqual(stored.rows[0]?.token_hash, expectedHash);
      assert.notEqual(stored.rows[0]?.token_hash.toString(), issued.token);
      assert.equal(stored.rows[0]?.user_agent, "MarketFa test agent");

      const resolved = await sessions.resolve(issued.token);
      assert.equal(resolved?.sessionId, issued.sessionId);
      assert.equal(resolved?.userId, userId);

      const rotated = await sessions.rotate(issued.token, "Rotated test agent");
      assert.ok(rotated);
      assert.notEqual(rotated.token, issued.token);
      const rotationChildren = await owner.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM user_sessions WHERE rotation_parent_id = $1",
        [issued.sessionId],
      );
      assert.equal(rotationChildren.rows[0]?.count, "1");
      assert.equal(await sessions.resolve(issued.token), null);

      const resolvedRotation = await sessions.resolve(rotated.token);
      assert.equal(resolvedRotation?.sessionId, rotated.sessionId);
      assert.equal(resolvedRotation?.userId, userId);

      assert.equal(await sessions.rotate(issued.token), null);
      assert.equal(await sessions.resolve(rotated.token), null);

      const logout = await sessions.create(verifiedIdentityId);
      assert.equal(await sessions.revoke(logout.token), true);
      assert.equal(await sessions.resolve(logout.token), null);
      assert.equal(await sessions.revoke(logout.token), false);

      const concurrent = await sessions.create(verifiedIdentityId);
      const concurrentRotations = await Promise.all([
        sessions.rotate(concurrent.token),
        sessions.rotate(concurrent.token),
      ]);
      assert.equal(concurrentRotations.filter(Boolean).length, 1);
      const concurrentWinner = concurrentRotations.find(Boolean);
      assert.ok(concurrentWinner);
      assert.equal(await sessions.resolve(concurrentWinner.token), null);

      const nearAbsoluteExpiry = await sessions.create(verifiedIdentityId);
      await owner.query(
        "UPDATE user_sessions SET created_at = now() - interval '29 days', last_seen_at = now(), expires_at = now() + interval '1 day' WHERE id = $1",
        [nearAbsoluteExpiry.sessionId],
      );
      const nearExpiryRotation = await sessions.rotate(
        nearAbsoluteExpiry.token,
      );
      assert.ok(nearExpiryRotation);
      const absoluteExpiry = await owner.query<{ expires_at: Date }>(
        "SELECT created_at + interval '720 hours' AS expires_at FROM user_sessions WHERE id = $1",
        [nearAbsoluteExpiry.sessionId],
      );
      assert.ok(
        new Date(nearExpiryRotation.expiresAt).getTime() <=
          absoluteExpiry.rows[0]!.expires_at.getTime(),
      );

      const idle = await sessions.create(verifiedIdentityId);
      await owner.query(
        "UPDATE user_sessions SET created_at = now() - interval '8 days', last_seen_at = now() - interval '8 days', expires_at = now() + interval '22 days' WHERE id = $1",
        [idle.sessionId],
      );
      assert.equal(await sessions.resolve(idle.token), null);

      const suspended = await sessions.create(verifiedIdentityId);
      await owner.query("UPDATE users SET status = 'SUSPENDED' WHERE id = $1", [
        userId,
      ]);
      assert.equal(await sessions.resolve(suspended.token), null);
      const revokedBySuspension = await owner.query<{
        revoked_at: Date | null;
      }>("SELECT revoked_at FROM user_sessions WHERE id = $1", [
        suspended.sessionId,
      ]);
      assert.ok(revokedBySuspension.rows[0]?.revoked_at);

      await assert.rejects(sessions.create(verifiedIdentityId));
      await owner.query("UPDATE users SET status = 'ACTIVE' WHERE id = $1", [
        userId,
      ]);
      assert.equal(await sessions.resolve(suspended.token), null);
    } finally {
      await owner.query("DELETE FROM users WHERE id = $1", [userId]);
      await Promise.all([owner.end(), runtime.end(), authRuntime.end()]);
    }
  },
);
