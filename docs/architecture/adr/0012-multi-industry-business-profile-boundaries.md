# ADR 0012: Multi-Industry Business Profile and Location Boundaries

- **Status:** Accepted product direction; target data-model implementation is pending review and pilot decisions.
- **Date:** 2026-11-01

## Context

MarketFa must let a business owner choose the type of work they do and receive a relevant workspace. A retail-only model cannot support service, repair, project, hospitality, manufacturing and other operating models without creating misleading or unused records.

The existing M2 foundation uses tenant and store concepts. The accounting schema proposed in PR #21 scopes books, accounts and periods by store. The multi-industry proposal in PR #26 creates a business profile but also creates a store for every new tenant. These assumptions need a deliberate boundary decision before merge.

## Decision

Use one modular monolith and one shared identity/tenant core. Keep these concepts separate:

1. Tenant: workspace, security and commercial-customer boundary.
2. Business profile: versioned operating business and industry configuration.
3. Business location: physical, virtual, project or service location.
4. Store/POS: optional retail capability and operational location.
5. Accounting book: ledger boundary for the relevant legal/accounting entity.
6. Capability: independently owned domain module.
7. Entitlement: commercial permission to use a capability.
8. Role permission: actor authorization.
9. Jurisdiction profile: legal/tax rules.
10. UI locale: language and presentation only.

An industry profile suggests capabilities. It does not itself activate a capability, grant a role, grant an entitlement, prove a licence or establish tax applicability.

A capability is usable only when release support, profile eligibility, dependencies/setup, entitlement, actor permission, location/book scope, jurisdiction and required specialist approvals all pass.

Regulated profiles may be discoverable before their workflows are ready. Their regulated capabilities remain unavailable until evidence, approval and required data controls are present.

## Data-model direction

Target relationship:

`Tenant → BusinessProfile → BusinessLocation`

Optional:

- BusinessLocation → Store/POS settings → Terminal.
- BusinessProfile/legal entity → AccountingBook.
- Operational records reference profile and location explicitly.
- Journals reference an accounting book; location is a dimension unless accounting policy requires separate books.

Do not require a store for service or project businesses. Do not scope the general ledger to a retail store by default.

## Versioning and history

- Industry templates are versioned and immutable after activation.
- Profile changes create an auditable versioned transition.
- Historical documents retain the rule, profile, unit, price, tax and account snapshots used at posting.
- A profile change must not reinterpret historical records.
- Unknown or unsupported capabilities fail closed and remain visible as unavailable/planned rather than silently disappearing.

## Migration and rollout

1. Preserve existing tenant/store IDs and retail behavior.
2. Add generic business locations before non-retail workflows depend on them.
3. Decide accounting-book cardinality and migrate accounting schema before posting services are built.
4. Backfill existing retail tenants with explicit, reversible mapping and reconciliation.
5. Keep regulated capabilities disabled until specialist review.
6. Add cross-tenant, cross-profile, location and book isolation tests.

## Consequences

- PR #26 cannot be merged solely because its picker and profile table exist. Its forced-store onboarding, regulated defaults, capability activation semantics, profile-version selection and branch ancestry must be resolved.
- PR #21 schema must be reviewed against accounting-book scope before it becomes a production migration.
- A broad industry catalogue can exist before every vertical workflow, but the UI must distinguish preview from working functionality.
- The product remains a modular monolith; do not create one app or database per profession.
