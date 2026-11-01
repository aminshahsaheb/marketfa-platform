# Product Requirements Document

**Status:** Updated product direction — multi-industry platform foundation
**Product:** MarketFa Platform
**Audience:** product, engineering, business operators

## 1. Product intent

Build one configurable business operations platform for different types of businesses. A person enters MarketFa, selects the type of business they run, and receives a workspace with the modules and workflows that fit that business.

MarketFa is not a retail-only application. Retail POS and inventory are one industry solution. The platform must also support service businesses and other operating models that do not use a retail stock ledger or checkout counter.

The product uses one shared platform core, versioned industry profiles, optional capability modules, and separate adapters for jurisdiction-specific rules and regulated workflows. The first launch jurisdiction remains Iran. This is a jurisdiction decision, not an industry restriction.

## 2. User journey

1. A person opens MarketFa and creates or signs in to an account.
2. The person creates a business workspace.
3. The person selects an industry and, where needed, a more specific business type.
4. MarketFa applies a versioned industry profile and shows the suggested modules.
5. The owner confirms business details, location, currency, timezone, fiscal settings and applicable legal profile.
6. The owner invites team members and assigns roles.
7. The workspace opens on a dashboard that fits the selected business.
8. The owner can add another business profile or location without creating a second identity.

An industry selection is a configuration template. It is not a permission grant, tax decision, professional licence, or proof of regulatory compliance.

## 3. Industry coverage model

The initial catalogue includes:

- Retail: general retail, grocery, apparel, electronics and pharmacy.
- Food service: restaurant, cafe, bakery and food preparation.
- Professional services: consulting, legal/accounting services and agencies.
- Repair and field services: repair shops, maintenance, installation and contractors.
- Health and beauty: clinics, dental practices, salons and wellness providers.
- Education: schools, training centres, tutors and classes.
- Construction and projects: contractors, builders and project-based businesses.
- Trade and distribution: wholesale, distributors and import/export operators.
- Manufacturing: workshops, production and assembly.
- Transport and logistics: delivery, fleet and freight services.
- Hospitality: hotels, guest houses and accommodation.
- Other business: a configurable starter workspace with shared core tools.

This catalogue is a starting taxonomy. It is not a claim that every profession-specific workflow is already implemented. Users must be able to select Other business and configure a workspace without retail concepts. New profiles use versioned configuration and tested domain rules, not a separate application fork.

## 4. Shared core and capability model

### Shared platform core

Identity, tenants, business profiles, locations, users, roles, invitations, customer and supplier directory, document references, payments, expenses, finance, audit, notifications, reports, exports and integrations.

### Optional capabilities

- Product and service catalogue.
- Inventory, batches, expiry and procurement.
- Point of sale, shifts, cash drawer and returns.
- Appointments, schedules and staff calendars.
- Work orders, repair intake and parts.
- Projects, budgets, milestones and cost tracking.
- Reservations, rooms, tables and guest operations.
- Production, recipes, bills of material and work centres.
- Delivery, dispatch and route operations.

An industry profile suggests capabilities. A business owner can configure optional capabilities when dependencies and permissions allow them. The server is authoritative for activation. A hidden menu item is not a security control.

## 5. Workspace and dashboard requirements

- Show an industry selection step during business setup.
- Provide search and an Other business option.
- Show a preview of modules before the owner confirms the profile.
- Build navigation from enabled capabilities and user permissions.
- Use a dashboard with configurable cards and actions for the selected business.
- Do not show retail-only terms such as SKU, stock or cashier to a service business unless it enables the related capability.
- Support multiple business profiles under one tenant, subject to tenant and permission policy.
- Allow a profile to change through a controlled migration. Never silently delete or reinterpret historical transactions when a business changes its industry.

## 6. Users and permissions

- **Owner:** business profile, workspace settings, users, plans and access grants.
- **Manager:** operational modules assigned to the business.
- **Operator:** assigned workflows and locations.
- **Accountant:** finance, journals, reconciliation and reports within granted scope.
- **Viewer:** read-only access to approved views.

Industry profile and role are separate. A user may work in several industries with different roles. Every API request derives tenant, business profile, location and actor scope from authenticated server-side identity. A client-supplied tenant or profile ID is a selector, never authorization proof.

## 7. Financial and jurisdiction boundaries

- Generic finance and accounting remain separate from industry-specific operational rules.
- Legal jurisdiction, tax profile, currency, timezone and fiscal calendar are explicit business settings. They are not inferred from industry or UI language.
- The initial Iran ledger uses integer IRR. Toman is an explicit input/display unit; 1 Toman = 10 Rial.
- No authoritative monetary calculation uses binary floating point.
- Tax rules, invoice applicability, rates and reporting are versioned and effective-dated.
- Do not encode a universal tax rate or a universal electronic invoice obligation.
- Moadian and other regulated integrations are isolated adapters. Verify official requirements and obtain specialist review before live use or compliance claims.
- Industry profiles do not grant a professional licence or replace legal review.

## 8. Non-functional requirements

Correctness, atomicity, idempotency, tenant and business-profile isolation, auditability, bounded offline behavior, extensibility, accessibility and full Persian RTL / English LTR support are required. UI locale must not change legal or accounting rules.

## 9. Delivery strategy

Do not attempt to implement every industry workflow in one release. Build the shared core and profile-selection contract first. Then deliver vertical packs in evidence-based phases.

Suggested first vertical packs:
1. General retail and grocery.
2. Professional services.
3. Repair and maintenance.
4. Food service.
5. Wholesale and distribution.
6. Further regulated and operationally complex industries after specialist review.

A catalogue entry may be selectable before every capability is live, but the UI must label unavailable modules as planned or disabled. Never present a preview as a working feature.

## 10. Acceptance principles

A feature is complete only when it has domain rules, authorization, persistence, audit events, failure behavior, automated tests and operator documentation. Industry selection must be tested for each profile. Capability activation must be server-authoritative. Financial workflows require ledger-level assertions and retry/concurrency tests. A test is PASS only after execution with retained evidence.
