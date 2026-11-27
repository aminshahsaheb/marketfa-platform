# Documentation index

Start with [STATUS.md](STATUS.md). Everything else is reference.

## architecture

- [Localization and Internationalization Standard](architecture/LOCALIZATION.md)
- [MarketFa — Master Architecture and Engineering Review](architecture/MASTER_ARCHITECTURE_REVIEW.md)
- [Identity, Tenancy, Business Profiles and Locations](architecture/TENANCY_AND_IDENTITY.md)
- [ADR 0001: Use a Modular Monolith](architecture/adr/0001-modular-monolith.md)
- [ADR 0002: PostgreSQL Is the Authoritative Store](architecture/adr/0002-postgresql-source-of-truth.md)
- [ADR 0003: Bounded Offline Operation](architecture/adr/0003-bounded-offline.md)
- [ADR 0004: Defer Unverified Market-Specific Financial Rules](architecture/adr/0004-defer-market-specific-financial-policy.md)
- [ADR 0005: Iran-First, Bilingual Product with Separate Locale and Compliance](architecture/adr/0005-iran-first-bilingual-product.md)
- [ADR 0006: Currency-Aware Integer Money with IRR Accounting Base](architecture/adr/0006-currency-aware-integer-money.md)
- [ADR 0007: Immutable Double-Entry Accounting Kernel](architecture/adr/0007-immutable-double-entry-accounting.md)
- [ADR 0008: Tenant Isolation with Database-Enforced Boundaries](architecture/adr/0008-tenant-isolation-with-rls.md)
- [ADR 0009: Provider-Neutral Authentication Boundary and Server-Side Sessions](architecture/adr/0009-provider-neutral-auth-sessions.md)
- [ADR 0010: SQL-First PostgreSQL Persistence for Tenant and Financial Invariants](architecture/adr/0010-sql-first-postgresql-persistence.md)
- [ADR 0011: Tenant Administration Through Atomic Database Commands](architecture/adr/0011-tenant-administration-commands.md)
- [ADR 0012: Multi-Industry Business Profile and Location Boundaries](architecture/adr/0012-multi-industry-business-profile-boundaries.md)
- [Data Integrity Rules](architecture/data-integrity.md)
- [Architecture Overview](architecture/overview.md)

## compliance

- [Iran Compliance Architecture](compliance/IRAN_COMPLIANCE.md)

## decisions

- [Open Product and Architecture Decisions](decisions/OPEN_DECISIONS.md)

## engineering

- [M1 Engineering Foundation](engineering/M1_FOUNDATION.md)

## finance

- [Accounting Kernel — Relational Data Model](finance/ACCOUNTING_DATA_MODEL.md)
- [Accounting Kernel — Domain Specification](finance/ACCOUNTING_KERNEL.md)
- [Monetary Model and Precision Standard](finance/MONEY_MODEL.md)

## legacy

- [Legacy MarketFa v1 — Engineering Audit](legacy/LEGACY_AUDIT.md)
- [Legacy Migration Policy](legacy/MIGRATION_POLICY.md)

## product

- [Product Requirements Document](product/PRD.md)

## roadmap

- [Engineering Roadmap](roadmap/ROADMAP.md)

## security

- [Authentication and Session Security Model](security/AUTHENTICATION_SESSION_MODEL.md)
- [Threat Model](security/THREAT_MODEL.md)

## testing

- [Accounting Kernel — Verification Plan](testing/ACCOUNTING_TEST_PLAN.md)
- [Bilingual and Iran-Localization Test Plan](testing/LOCALIZATION_TEST_PLAN.md)
- [Money and Currency Test Vectors](testing/MONEY_TEST_VECTORS.md)
- [Quality Gates](testing/QUALITY_GATES.md)
- [Tenant Isolation and Identity Verification Plan](testing/TENANCY_SECURITY_TEST_PLAN.md)
