# Iran Compliance Architecture

**Status:** Architecture baseline only. This document is not legal or tax advice and does not certify compliance.

## 1. Scope

Iran is the first launch jurisdiction. The platform must support Iran-specific tax and electronic invoicing without embedding those rules in the generic accounting kernel.

The legal and technical rules change. Every rule must have:

- official source document and source URL;
- publication date and effective-from/effective-to dates;
- jurisdiction and taxpayer/transaction scope;
- version identifier;
- reviewer and approval record;
- executable test vectors;
- migration/transition behavior for existing records.

## 2. Domain separation

- Generic accounting: chart of accounts, balanced journals, fiscal periods, immutable posting and reversals.
- Iran tax profile: tax categories, exemptions, taxpayer classification, invoice rules, tax calculations and statutory reports.
- Moadian adapter: authentication/signing, invoice serialization, submission, polling, response parsing and reconciliation.
- POS receipt: operational proof of sale, not automatically a statutory electronic invoice.
- Electronic tax invoice: statutory document governed by the currently applicable official schema and acceptance state.

Do not let a UI locale select the compliance profile. Store jurisdiction selects the profile.

## 3. Moadian integration boundary

The integration must be an adapter behind an application port. It must support:

- credential and private-key protection outside browser storage;
- key/certificate lifecycle and revocation;
- schema-versioned serialization and validation;
- durable submission outbox and idempotent retries;
- explicit states such as draft, ready, submitted, accepted, rejected, retryable_error, and requires_review;
- correlation IDs and immutable response metadata;
- reconciliation between local invoices and tax-system outcomes;
- operational monitoring and safe replay.

Never mark a tax invoice accepted merely because the local API accepted the request. Acceptance must be based on the authoritative tax-system response under the applicable protocol.

## 4. Offline behavior

A local offline receipt is provisional. Offline mode cannot assert successful Moadian submission or acceptance. When connectivity returns, the system validates and submits under the current rules. Rejection must create a visible exception and an operator workflow; it must not silently rewrite a posted accounting event.

The statutory timing and outage procedures must be implemented only after review of current official rules. The system must retain evidence of outages and fallback actions where legally required.

## 5. Rule configuration

Tax rates, exemptions, invoice types, taxpayer eligibility, thresholds, and effective dates must be data-driven and versioned. Avoid a single hard-coded VAT percentage. Preserve the rule version used for each posted transaction and tax invoice.

## 6. Sources and verification

Initial legal reference:

- [Law on Point-of-Sale Terminals and Taxpayer System](https://law-ir.ir/law/cat/1769/) — useful consolidated legal text; verify amendments against official publication.
- [Taxpayer System / electronic invoice technical guidance portal](https://www.intamedia.ir/) — official authority portal; capture the exact current schema and circular before implementation.
- [Official Tax Affairs Organization portal](https://www.tax.gov.ir/) — official portal.

A secondary report dated 26 Tir 1405 describes an extension through the end of 1405 for a limited category of taxpayers/transactions involving POS receipts. Treat this only as a research lead, not as a rule to encode. Confirm the primary circular and exact scope with the official authority before implementation.

## 7. Mandatory approval gate

No production tax feature until an Iran tax/accounting reviewer approves:

- current taxpayer applicability and exemptions;
- VAT categories/rates and effective dates;
- invoice types and required fields;
- Moadian schema/API version and signing model;
- legal outage and correction/cancellation procedures;
- exact currency units, decimal precision, and rounding/truncation rules.
