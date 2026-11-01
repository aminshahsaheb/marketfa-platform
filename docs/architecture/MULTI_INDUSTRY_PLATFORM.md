# Multi-industry platform architecture

**Status:** Proposed architecture decision for MarketFa's expanded product scope.

## Decision

MarketFa is a multi-industry business operations platform, not a retail-only product. Use one modular monolith and one shared platform core. Add industry profiles and capability packs as configuration over explicit domain modules.

Do not create a separate application, database schema or code fork for each profession.

## Concepts

- Tenant: the security and ownership boundary.
- Business profile: an operating business under a tenant. It has an industry identifier, profile version, legal settings and enabled capabilities.
- Location: a physical or operational location owned by a business profile.
- Industry profile: a versioned template. It suggests capabilities, navigation, dashboard cards, workflow presets and setup questions.
- Capability: a domain module such as inventory, appointments, work orders, projects or reservations.
- Module entitlement: the commercial permission to use a capability.
- Role permission: the actor's permission to perform an action.
- Jurisdiction profile: legal/tax rules for the business. It is separate from industry, locale and user role.

## Capability activation rule

A capability is available only when all required checks pass:

1. The capability is supported by the deployed application version.
2. The business profile enables it.
3. The tenant plan or entitlement permits it, if plans apply.
4. The actor has the required permission.
5. Required dependencies and setup are valid.
6. Any jurisdiction-specific gate is satisfied.

The server evaluates these checks. Frontend navigation is a presentation of server-authorized capabilities, not a security boundary.

## Domain boundaries

### Shared core

Identity, tenancy, business profiles, locations, memberships, permissions, customer/supplier directory, document references, payments, expenses, finance, audit, notifications, reporting, localization and integration contracts.

### Vertical capabilities

- Retail: catalogue, stock ledger, procurement, POS, shifts, returns and stock valuation.
- Food service: menu, table/order workflow, kitchen tickets, recipes, ingredient consumption and delivery.
- Services: service catalogue, appointments, quotes, work orders, time records and invoices.
- Repair: intake, diagnosis, work orders, parts consumption, status and handover.
- Projects/construction: project budgets, milestones, purchase commitments, work orders and progress claims.
- Wholesale/distribution: customer pricing, sales orders, picking, dispatch, delivery and receivables.
- Manufacturing: bill of materials, production orders, material issues, output, scrap and work-centre capacity.
- Hospitality: reservations, rooms, check-in/out, guest folios and housekeeping.

These are domain packs. A business may enable more than one pack. Do not force every pack into the same sales-and-stock workflow.

## Data model direction

Add a business-profile aggregate under tenant scope. At minimum it needs:

- business_profiles: tenant, display name, industry key, profile version, status and legal-profile references.
- business_locations: business profile, address/timezone and operational settings.
- business_profile_capabilities: enabled capability key, configuration version, activation actor/time and status.
- A versioned industry catalogue in code or controlled reference data.

Use composite tenant-scoped foreign keys and forced RLS for tenant-owned records. Derive tenant scope from the authenticated actor. Do not trust a client-supplied tenant ID. Keep location and business profile IDs explicit in operational records.

Do not store a single mutable industry field on the tenant and use it to reinterpret historical data. Industry changes create a versioned profile change. Existing records keep their original domain type, rules and snapshots.

## Onboarding and dashboard

1. Sign in or create an account.
2. Create a business workspace.
3. Search and select an industry, or select Other business.
4. Preview the recommended modules and setup steps.
5. Set legal jurisdiction, currency, timezone and fiscal settings separately.
6. Create the first location and invite staff.
7. Open a dashboard built from enabled capabilities and actor permissions.

The dashboard is composed from module-owned cards and actions. Each module supplies its own route, permission requirements, data contract and empty state. Do not build one universal dashboard full of irrelevant retail fields.

## Security and regulated workflows

Industry profile selection is not a licence, role, entitlement or compliance assertion. Regulated industries such as pharmacy, healthcare, financial services and legal practice require separate legal, privacy, retention and workflow review before activation. Sensitive personal data requires its own access controls and audit model.

## Migration strategy

Existing retail concepts become the first vertical pack. Keep existing accounting and money invariants. Do not rename or reinterpret legacy retail tables as generic records without a migration plan. A service business must not be forced to create fake stock or cash-register records to use shared finance.

## Testing requirements

- Every industry key is unique and versioned.
- Every profile references only registered capabilities.
- Unknown industry IDs fail closed or use the explicit Other business flow; never silently map to retail.
- Capability dependencies and entitlements are enforced server-side.
- Tenant and business-profile isolation tests cover all module endpoints and background jobs.
- Changing a profile does not alter historical records.
- Each vertical pack has golden workflow, authorization, idempotency, concurrency and localization tests.
