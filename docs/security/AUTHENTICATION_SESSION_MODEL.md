# Authentication and Session Security Model

**Status:** Security requirements accepted; login mechanism not selected.

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
