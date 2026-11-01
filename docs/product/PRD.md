# Product Requirements Document

**Status:** Multi-industry product direction confirmed; pilot scope and policy decisions remain open  
**Product:** MarketFa Platform  
**Audience:** product, engineering, business operators and pilot partners

## 1. Product intent

Build one business operations platform for different kinds of work. A person creates an account, selects the type of business they run, and receives a workspace with relevant modules and workflows.

MarketFa is not a retail-only application. Retail POS and inventory are one vertical pack. A consulting business must not need a stock ledger. A repair business must not need a cashier shift. A project contractor must not be forced into a retail sale. The shared platform provides identity, tenancy, customer/supplier directory, documents, payments, expenses, finance, audit, reporting and integrations. Each vertical owns its operational data and workflows.

The initial jurisdiction is Iran. Jurisdiction is a legal setting, not an industry label or UI locale.

## 2. Product model and boundaries

The platform keeps these concepts separate:

- **User:** one human identity, possibly a member of several tenants.
- **Tenant:** workspace, security and commercial-customer boundary.
- **Membership:** a user's role and permissions in a tenant.
- **Business profile:** a versioned operating business with an industry template and configured capabilities.
- **Business location:** a physical branch, office, workshop, project site, virtual operation or service area.
- **Store:** a retail/POS concept. Do not require every business to create a store merely to use the platform.
- **Terminal:** a registered device assigned to a supported location and workflow.
- **Accounting book:** a ledger boundary for a legal/accounting entity. A book is not automatically tied to a POS store.
- **Industry profile:** a versioned template that suggests modules and setup steps. It is not a license or authorization.
- **Capability:** a separately owned domain module.
- **Entitlement:** commercial permission to use a module.
- **Role permission:** permission for an actor to perform a specific action.
- **Jurisdiction profile:** tax/legal rules and reporting obligations.
- **UI locale:** language, calendar and display formatting only.

A tenant may later contain more than one business profile. Whether the MVP enables this is an open product decision. The data model must not block it.

## 3. User journey

1. A person signs in or creates an account.
2. The person creates a workspace.
3. The person searches and selects an industry or selects **Other business**.
4. MarketFa shows suggested modules and clearly labels available, planned, unavailable and regulated capabilities.
5. The owner confirms the business profile, legal entity details, location, timezone, currency and fiscal settings.
6. The owner configures only the capabilities supported by the release and permitted by policy.
7. The owner invites staff and assigns roles.
8. The dashboard shows module-owned cards and actions that the actor can use.
9. The business can add a location or a second business profile when the approved plan permits it.

The user must not confuse a preview with an implemented workflow.

## 4. Industry coverage

The first taxonomy should cover broad operating models, not attempt to enumerate every job title:

- Retail and grocery.
- Food service, cafe and bakery.
- Professional and consulting services.
- Repair, maintenance and field service.
- Health, wellness and beauty.
- Education and training.
- Construction and project-based work.
- Wholesale and distribution.
- Manufacturing and workshops.
- Transport and logistics.
- Hospitality and accommodation.
- Other business, with a configurable starter workspace.

The catalogue is extensible. A new industry is a versioned configuration over domain capabilities, not a separate application. A specific profession may need a subtype, workflow extension or dedicated module. Do not claim full coverage until its workflows are implemented and tested.

## 5. Shared core and vertical capabilities

### Shared platform capabilities

Identity, tenant administration, business profiles, locations, memberships, permissions, customer and supplier directory, documents, payments, expenses, accounting, audit, notifications, reports, exports, integration contracts and platform settings.

### Vertical capabilities

- **Retail:** catalogue, barcode, stock ledger, procurement, batches/expiry, POS, shifts, tenders and returns.
- **Food service:** menu, table/order flow, kitchen tickets, recipes, ingredient consumption and delivery.
- **Services:** service catalogue, appointments, quotes, work orders, time records and invoices.
- **Repair:** intake, diagnosis, work orders, parts, repair status and handover.
- **Projects/construction:** project budgets, milestones, purchase commitments, cost tracking and progress claims.
- **Wholesale/distribution:** customer pricing, sales orders, picking, dispatch, delivery and receivables.
- **Manufacturing:** bill of materials, production orders, material issues, output, scrap and work-centre capacity.
- **Hospitality:** reservations, rooms, check-in/out, guest folios and housekeeping.
- **Transport/logistics:** jobs, fleet, route, dispatch, proof of delivery and settlement.

A business can enable more than one pack if dependencies and policy allow it. Do not force all packs into one universal sales-and-stock workflow.

## 6. Capability activation contract

An industry template recommends capabilities. It does not grant them automatically.

A capability is usable only if the server verifies all applicable conditions:

1. The deployed application release supports it.
2. The selected business-profile version allows it.
3. Required dependencies and setup are complete.
4. The tenant has the required entitlement, where plans apply.
5. The actor has the required permission.
6. The location/accounting scope is valid.
7. Jurisdiction rules permit the workflow.
8. Any specialist or regulatory approval gate is satisfied.

Keep suggested, available, enabled, suspended and retired states distinct. Frontend navigation is a view of server-authorized capabilities, never the security boundary.

## 7. Regulated and sensitive workflows

A profile may be visible in the catalogue before its specialist workflow is ready. Regulated profiles must not activate regulated capabilities merely because a user selected the profile. Separate profile selection from legal eligibility, licence verification, sensitive-data controls and workflow approval.

Health, pharmacy, financial, legal and similar domains require separate privacy, retention, access-control, audit and legal review. Do not collect sensitive data before the relevant controls and lawful basis are established. Do not make compliance claims from a catalogue label.

## 8. Finance, money and jurisdiction

- Generic accounting is separate from industry-specific source workflows.
- The accounting book belongs to the relevant legal/accounting entity or business profile; locations are dimensions unless an approved policy requires separate books.
- The initial Iran ledger uses integer IRR. Toman is an explicit input/display unit; 1 Toman = 10 Rial.
- No authoritative money calculation uses binary floating point.
- Quantity precision and unit conversions are explicit and snapshotted where needed.
- Tax, invoice applicability, rounding and statutory reporting are versioned and effective-dated.
- Do not infer tax profile from industry, locale or currency.
- Do not encode a universal VAT rate or universal electronic invoice obligation.
- Moadian is a separate adapter. Verify the current official schema and legal scope before live use.

Fractional quantity, line/tax rounding, deterministic remainder allocation, fiscal calendar, chart of accounts, inventory costing and COGS timing require specialist approval.

## 9. Workspace and dashboard

- Navigation comes from enabled capabilities and actor permissions.
- Each module owns its route, permission requirements, data contract, dashboard cards, actions and empty states.
- Hide irrelevant retail terms from service businesses unless the related capability is enabled.
- Provide search and Other business.
- Mark unavailable modules as planned or unavailable. Do not show a live action that has no backend workflow.
- Support Persian RTL and English LTR throughout each complete workflow.
- Support keyboard operation and accessible labels for core tasks.

## 10. Non-functional requirements

Correctness, tenant and profile isolation, least privilege, atomicity, idempotency, auditability, data minimization, recoverability, bounded offline behavior, accessibility, localization, observability and maintainability are required.

Use one modular monolith until measured scale or independent operational needs justify service separation. Keep domain boundaries explicit inside the monolith.

## 11. Delivery strategy

Do not implement every industry in one release. Choose one or two pilot verticals from operator evidence. Build the shared core, then complete each vertical end to end. A profile catalogue can be broader than the implemented workflow catalogue, provided the UI labels the difference clearly.

## 12. Acceptance principles

A feature is complete only when it has:

- domain rules and approved acceptance scenarios;
- authenticated actor, tenant/profile/location scope and server-side authorization;
- database constraints and explicit transaction boundaries;
- retry, idempotency and concurrency behavior;
- audit and outbox behavior for consequential changes;
- unit, PostgreSQL integration and API authorization tests;
- browser workflow, accessibility and localization tests where relevant;
- migration, rollback and operator documentation;
- CI evidence from the exact commit.

A test file existing is not evidence that the test passed. A selectable profile is not evidence that its workflows are implemented.
