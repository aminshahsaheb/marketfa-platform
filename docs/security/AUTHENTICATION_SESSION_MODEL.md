# Authentication and Session Security Model

**Status:** Provider-neutral opaque session core implemented; authentication provider and HTTP cookie integration remain open.

## Implemented session core

- Generate 256-bit cryptographically random base64url bearer tokens.
- Store only SHA-256 token hashes in PostgreSQL; the raw token is returned once to the trusted API caller.
- Enforce a 30-day absolute lifetime and a 7-day idle timeout as initial engineering defaults.
- Rotate a session atomically: revoke the old token and create a same-user child session in one database function call.
- Detect reuse of a rotated token and revoke the descendant session family. Clients must serialize refresh attempts; duplicate refreshes intentionally require reauthentication.
- Revoke a session on logout.
- Reject malformed, expired, idle, revoked, or suspended-user sessions.
- Automatically revoke all sessions when a user changes from ACTIVE to a non-active status.
- Use a non-login, non-superuser, non-BYPASSRLS function-owner role with narrowly scoped RLS policies. The ordinary runtime login can resolve, rotate, and revoke sessions but cannot create them or directly read/write session rows. A separate non-inheriting auth-runtime login can resolve verified provider identities and execute session creation; session creation accepts a verified auth-identity record rather than an arbitrary user ID. The auth-runtime login has no direct table access.

These are initial security defaults, not customer-configurable settings yet. Review them before production based on threat model, device persistence, and pilot needs.

Not yet implemented: an AuthProvider, login/registration/recovery endpoints, cookie issuance/clearing, CSRF/origin checks, rate limiting, step-up authentication and global session revocation after credential reset. Do not expose the session service as an HTTP endpoint until those controls are implemented.

## Session model

Use opaque cryptographically random bearer secrets in Secure, HttpOnly cookies. Persist only a strong hash of the secret. Session records include user_id, token_hash, created_at, expires_at, last_seen_at, revoked_at, rotation_parent_id, and limited device metadata.

- Never store raw session tokens.
- Rotate after login, reauthentication, privilege change, and suspicious activity.
- Revoke current session on logout; support global session revocation.
- Enforce idle and absolute expiry.
- Validate active user status and tenant membership on every request.
- Do not place tenant roles or permissions in long-lived client claims as the authority source.
- Use SameSite=Lax or stricter where compatible; use CSRF tokens/origin checks for state-changing cookie-authenticated requests.
- TLS is mandatory outside local development.

## Identity model

A user can have multiple verified identities. auth_identities stores provider_key + provider_subject, normalized identifier, verification state, and timestamps. Do not assume phone or email is globally available or verified.

AuthProvider is an application boundary. It may later support password, SMS OTP, email link, or a trusted external identity provider. The exact initial mechanism remains a product decision.

## Password path (if selected)

- Hash with Argon2id using parameters benchmarked on deployment hardware.
- Never encrypt or store recoverable passwords.
- Use generic login errors to avoid account enumeration.
- Rate-limit by account and network/device signals.
- Require secure reset tokens stored as hashes, short expiry, one-time use.
- Revoke active sessions after credential reset.

## OTP path (if selected)

- Generate codes using a cryptographically secure random generator.
- Store a keyed hash, never the raw code.
- Short expiry, one-time use, attempt limits, resend cooldown, per-identifier and per-IP throttles.
- Prevent response timing and message differences from disclosing whether an account exists.
- Never log OTP values.
- SMS delivery failure is an explicit user-visible state; do not silently treat queued messages as delivered.
- Provider choice and local telecom reliability/cost require pilot validation.

## Step-up and recovery

Ownership transfer, changing authentication factors, exporting sensitive records, and changing high-risk security settings require recent authentication and explicit confirmation. Recovery must not permit a lower-assurance path to bypass stronger enrolled factors.

## Threat cases

- Session fixation and token theft.
- CSRF and cross-site cookie abuse.
- Brute force, credential stuffing, OTP flooding and SIM-swap risk.
- Account enumeration.
- Replay of invitation/reset/OTP tokens.
- Session reuse after role removal or account suspension.
- Stolen terminal credentials.
- Tenant ID substitution and privilege escalation.

The test plan must include these cases before production use.
