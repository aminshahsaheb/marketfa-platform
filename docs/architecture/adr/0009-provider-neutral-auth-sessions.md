# ADR 0009: Provider-Neutral Authentication Boundary and Server-Side Sessions

- **Status:** Security model accepted; initial login method open
- **Date:** 2026-10-30

## Context

MarketFa launches in Iran and serves operators with different device, connectivity, and recovery needs. Choosing SMS OTP or password without pilot evidence creates cost and account-recovery risk. Security must not depend on that choice.

## Decision

- Define AuthProvider and normalized identity boundaries independent from tenant membership.
- Store opaque session token hashes server-side; use Secure, HttpOnly cookies.
- Rotate/revoke sessions and revalidate user/membership/role on every request.
- Apply CSRF/origin protections, rate limits, anti-enumeration behavior, and step-up checks for high-risk actions.
- Store only verified identity references; never trust client-supplied user or role.
- Keep the first login mechanism open until product discovery validates phone/email access, delivery reliability, abuse controls, and support cost.

## Consequences

- Auth mechanism is an M2 product gate.
- Password and OTP implementations must follow the security requirements in docs/security/AUTHENTICATION_SESSION_MODEL.md.
- Session state remains server-authoritative; no long-lived client role claims.
