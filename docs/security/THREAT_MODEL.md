# Threat Model

**Status:** Initial baseline; update before pilot and after major changes.

## Assets

- Tenant financial records and customer/supplier data.
- Credentials, sessions, API secrets, backup encryption keys.
- Stock, pricing, tax configuration, journal integrity.
- Device identity and queued offline commands.

## Trust boundaries

1. Browser/device to API.
2. Tenant A to tenant B.
3. Cashier to manager/accountant/owner capabilities.
4. API to PostgreSQL.
5. Application to backup storage and deployment secrets.
6. Offline device replay to server-authoritative state.

## Threats and controls

| Threat                      | Required control                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| Cross-tenant data access    | Server-derived tenant scope, tenant-aware queries, negative authorization tests, optional RLS |
| Forged price/discount/stock | Recompute and authorize on server                                                             |
| Duplicate replay            | Idempotency key with unique database constraint and stored outcome                            |
| Concurrent oversell         | Transactional row lock/conditional stock update and conflict response                         |
| Journal tampering           | Immutable posted entries; reversal workflow; append-only audit                                |
| Privilege escalation        | Role/permission checks per use case; no client role trust                                     |
| Session theft/CSRF          | Secure session design, HttpOnly cookies, SameSite, CSRF defense                               |
| Secret leakage              | Secret scanning, env-only secrets, rotation procedure                                         |
| Backup theft                | Encryption, least privilege, restore drills                                                   |
| Malicious dependencies      | Lockfile, dependency review, automated vulnerability checks                                   |
| Device loss                 | Minimal local data, device revocation, local cache protection assessment                      |

## Release security gates

- Tenant-isolation tests for every tenant-owned API family.
- Authentication and authorization negative tests.
- No critical/high unresolved dependency or static-analysis finding without written risk acceptance.
- Secret scan clean.
- Backup restore test documented.
- Audit coverage for privileged and financial actions.
- Offline replay cannot bypass current server authorization or stock policy.

This is not a formal security certification or penetration test.
