# Security Policy

## Reporting
Do not disclose vulnerabilities in public issues. Contact the repository owner privately through GitHub.

## Sensitive information
Never commit passwords, access tokens, private keys, production environment files, payment credentials, customer exports, or unredacted backups. Public client configuration values are not authorization controls; security must be enforced by server rules.

## Development expectations
- Validate authentication, tenant scope, and permission on the server.
- Treat all browser input and offline commands as untrusted.
- Audit sensitive financial and administrative operations.
- Keep dependencies locked and review security advisories.
- Do not claim security certification from automated checks alone.

## Incident response
1. Revoke exposed credentials and sessions.
2. Preserve relevant audit/log evidence without copying sensitive payloads.
3. Assess tenant and financial impact.
4. Notify affected parties as required by applicable law.
5. Record remediation and recovery steps.
