# Open Product and Architecture Decisions

This register prevents assumptions from silently becoming product, accounting, legal or security rules. A decision is closed only when its owner, evidence, date and consequences are recorded.

## Confirmed decisions

- **OD-001 — Launch jurisdiction:** Iran first. This does not make every industry legally eligible for every workflow.
- **OD-002 — First locales:** Persian (`fa-IR`) and English (`en`).
- **OD-003 — Locale separation:** UI language/calendar/digits do not select jurisdiction, tax, currency or accounting policy.
- **OD-004 — Canonical Iran ledger unit:** integer IRR; Toman is explicit input/display only; 1 Toman = 10 Rial.
- **OD-005 — Architecture:** modular monolith, PostgreSQL source of truth, SQL-first persistence, versioned migrations.
- **OD-006 — Product direction:** multi-industry business operations platform. Retail POS/inventory is one vertical, not the universal model.
- **OD-007 — Offline safety:** no unrestricted multi-terminal offline stock allocation; offline behavior must be bounded and server-revalidated.
- **OD-008 — Financial immutability:** posted journals are immutable; corrections use linked reversals/compensating records.
- **OD-009 — Security:** tenant scope is server-derived; RLS is defense in depth, not a substitute for API authorization.
- **OD-010 — Delivery:** a catalogue/profile preview does not mean the corresponding workflows are implemented or approved.

## Product and domain decisions still open

- **OD-011 — Pilot verticals:** select one or two verticals based on operator interviews and measurable workflows.
- **OD-012 — Business hierarchy:** confirm tenant, legal entity, business profile and location relationships; define whether one tenant may contain multiple legal entities.
- **OD-013 — Location model:** define physical, virtual, project-site and service-area locations. Keep retail store/POS concepts optional.
- **OD-014 — Accounting book scope:** decide whether each business profile maps to one book, whether multiple profiles can share a legal-entity book, and which dimensions identify locations.
- **OD-015 — Tenant profile cardinality:** confirm one or multiple business profiles in the first release.
- **OD-016 — Industry taxonomy:** define broad categories, subtypes and the Other-business configuration path. Do not attempt to enumerate every job title.
- **OD-017 — Capability lifecycle:** approve suggested/available/enabled/suspended/retired states, dependency graph and entitlement policy.
- **OD-018 — Regulated profiles:** define evidence, reviewer, approval state and data controls before activating regulated workflows.
- **OD-019 — MVP acceptance:** approve at least ten end-to-end scenarios and measurable pilot outcomes.
- **OD-020 — Scale profile:** record expected users, locations, terminals, daily events, peak concurrency and retention.

## Identity, security and operations decisions

- **OD-021 — Authentication method:** choose password, OTP, email link or provider based on pilot evidence and threat analysis.
- **OD-022 — Account proofing/recovery:** define identity proofing, recovery, support override, recent-authentication and account-takeover controls.
- **OD-023 — Invitation delivery:** select email/SMS provider, delivery retries, expiry and abuse controls.
- **OD-024 — Hosting and data residency:** decide after legal review, threat model, latency and backup constraints.
- **OD-025 — Privacy and retention:** define personal-data inventory, purpose, access, retention, deletion/hold and breach response.
- **OD-026 — Hardware:** scanner, scale, printer, cash drawer, supported browsers and device lifecycle.
- **OD-027 — Offline policy:** define allowed commands, offline duration, terminal count and manual-review states.

## Accounting and Iran compliance blockers

- **OD-028 — Quantity precision:** unit-specific precision, conversion snapshots and rounding boundaries.
- **OD-029 — Monetary rounding:** line, discount, tax and deterministic remainder allocation approved by an Iran accountant.
- **OD-030 — Fiscal calendar:** fiscal-year start, period boundaries, close/reopen authority and reporting.
- **OD-031 — Chart of accounts:** approved starter template and account hierarchy rules.
- **OD-032 — Inventory costing/COGS:** approved costing method, cost timing, returns and damaged-stock treatment.
- **OD-033 — Tax/Moadian:** current official source, effective dates, taxpayer scope, invoice types, field units, schema version, signing and outage procedures.
- **OD-034 — Payment/tender policy:** cash, card, bank, clearing accounts, settlement and refund workflows.

## Data, analytics and migration decisions

- **OD-035 — Legacy import:** obtain sanitized source export, hashes, field mapping, data-quality report and reconciliation approval.
- **OD-036 — Analytics boundary:** define operational vs analytical stores, event contracts, tenant isolation, retention and PII minimization.
- **OD-037 — Reporting:** define authoritative read models, export formats, permitted aggregates and audit requirements.
- **OD-038 — Recovery objectives:** set RPO/RTO, backup frequency, retention, encryption and restore-test schedule.

## Approval rule

Do not close a legal, tax, accounting or privacy decision from a secondary summary or legacy implementation. Record the primary source, publication/effective date, jurisdiction/scope, reviewer, test vectors and migration behavior. If evidence is missing, keep the decision open and block the dependent feature.
