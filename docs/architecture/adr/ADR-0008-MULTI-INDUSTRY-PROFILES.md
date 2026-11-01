# ADR-0008: Multi-industry business profiles and capability packs

- **Status:** Proposed
- **Date:** 2026-11-01
- **Decision owners:** Product and engineering

## Context

The original product brief described MarketFa as a retail POS, inventory and accounting platform. The product requirement is now broader: each business owner selects their type of work and receives a workspace that covers the workflows of that business. A retail-only data model or dashboard cannot meet this requirement.

## Decision

Adopt a multi-industry platform model with one tenant and identity core, one or more business profiles under a tenant, versioned industry templates, explicit capability modules, role permissions and commercial entitlements independent from industry selection, and jurisdiction settings independent from industry and UI locale.

The initial industry catalogue includes retail, food service, professional services, repair/maintenance, health/beauty, education, construction/projects, wholesale/distribution, manufacturing, transport/logistics, hospitality and Other business.

## Consequences

- Existing retail workflows become the first vertical pack, not the universal platform model.
- Business-profile and capability contracts must be designed before more retail-only screens.
- Each vertical pack owns its workflows and data. Shared finance must not require fake inventory or POS records.
- Regulated industries require separate review. Catalogue visibility does not mean production readiness or legal permission.
- Industry changes are versioned. They must not rewrite historical transactions.
- Product delivery is phased. A selectable profile may show planned capabilities, but the UI must not claim that an unavailable workflow is live.

## Rejected alternatives

- One app per profession: duplicates identity, security, finance and maintenance.
- One universal retail schema: forces service and project businesses into incorrect stock/POS concepts.
- A free-form industry string: does not provide stable capabilities, dependencies, tests or versioning.
- Client-only module hiding: does not enforce authorization or entitlements.

## Follow-up

1. Approve the first two vertical packs using pilot evidence.
2. Define business-profile schema and capability activation commands.
3. Define module dependency and entitlement policy.
4. Add tenant and business-profile isolation tests.
5. Keep regulated workflow activation behind explicit review.
