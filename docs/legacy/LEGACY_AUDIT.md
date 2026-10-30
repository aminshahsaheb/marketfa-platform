# Legacy MarketFa v1 — Engineering Audit

**Audit date:** 2026-10-30  
**Scope:** supplied standalone source tree at `/mnt/data/marketfa_review/marketfa-standalone`  
**Purpose:** preserve verified behavior and prevent unsafe architectural carry-over.  
**Status:** static/source audit plus a limited local test run; not a production security review.

## 1. Evidence inspected

The supplied source tree contains:

- 11 application JavaScript files under `js/`.
- A 1,171-line Firestore data layer and a 663-line pure domain module.
- POS, inventory, accounting, reporting, dashboard, and shared UI views.
- Firestore rules, a static PWA shell, Service Worker, build scripts, and test harnesses.
- Domain, integration, adversarial, offline, simulation, render-smoke, browser E2E, and dist freshness test files.

No `.git` history is present in the supplied source folder. The source archive therefore does not establish its commit provenance or a complete release history.

## 2. Verified capabilities

The source implements:

- Barcode-based POS, count and weight products, cart discounts, cash/card tender, held invoices, receipts.
- Products with multiple units, conversion factors, batch stock, expiry dates, and FEFO selection.
- Purchase batch entry with a corresponding accounting voucher.
- Full and partial returns, including a damaged/non-restocked path.
- Shift opening/closing, float, tender counters, refunds, and cash variance.
- Double-entry vouchers, manual vouchers, reversals, trial balance, P&L, balance sheet, account ledger.
- Sales and product profitability reports, CSV export, Jalali date ranges.
- JSON backup validation and restore.
- PWA assets and Firestore IndexedDB persistence attempt.

## 3. Tests actually run

| Test                                             | Result                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `node tests/domain.test.js`                      | PASS — 30 test groups, including randomized accounting and return invariants |
| `node tests/dist-fresh.test.js`                  | PASS — dist and Service Worker match build identifier `1275927414`           |
| Integration / adversarial / offline / simulation | NOT RUN in this audit environment; `esbuild` dependency was absent           |
| Render smoke / browser E2E                       | NOT RUN; required build/browser dependencies were not available              |
| Firebase Emulator / real Firebase project        | NOT RUN; no emulator or authorized live test environment was configured      |

An attempt to install the legacy build dependencies timed out. No dependency files were added to this repository as a result.

**Interpretation:** domain tests provide useful evidence for pure calculations. They do not prove the Firestore transaction layer, offline behavior, browser UI, Firebase rules, or production readiness.

## 4. Critical architectural findings

### L-01 — Client is the trust boundary (critical)

The client holds the business workflows and writes directly to Firestore. The current rules permit any authenticated user whose UID equals the store document ID to read and write every nested document under that store. There is no server-authoritative command boundary, store membership model, or fine-grained cashier/accountant permission enforcement.

**New-platform response:** all financial and inventory commands go through the API. Tenant membership and permission checks happen server-side. PostgreSQL constraints and transactions enforce invariants.

### L-02 — Single-owner identity model (high)

The app uses `user.uid` as `storeId`; its UI explicitly tells users to share one email/password across devices. This is not a safe multi-user store model and cannot support separate cashier identities and revocation.

**New-platform response:** users, tenants, stores, memberships, roles, devices, and sessions are separate entities.

### L-03 — Offline multi-device stock and shift conflicts (critical)

The architecture document itself acknowledges that two offline devices can sell the same batch beyond available stock, that offline sales may be applied after another device closes a shift, and that stale prices/conversion factors can be used. Concurrent offline returns on the same invoice line can also conflict.

**New-platform response:** offline commands are bounded, replayed idempotently, revalidated by the server, and may be rejected or require review. Do not promise unrestricted offline multi-terminal stock selling.

### L-04 — Idempotency key lifetime is not durable (high)

POS and return request keys are held in React refs. The ambiguous-key guard is an in-memory Set. A reload can lose the original request key and its ambiguity state. A retry after reload may therefore fail to reuse the original idempotency identity.

**New-platform response:** persist command IDs and idempotency keys in a durable local outbox before dispatch; server stores the idempotent outcome under a unique constraint.

### L-05 — Offline persistence failure is non-fatal (high)

Firebase multi-tab IndexedDB persistence failure is caught and logged as a warning, after which the app continues. The UI does not make a clear, blocking distinction between durable offline mode and a session without durable persistence.

**New-platform response:** detect and expose storage capability at startup. Disable offline guarantees and risky actions when durable local storage is unavailable.

### L-06 — Bootstrap is inferred from product count (high)

`ensureStoreReady` seeds demo data when the products collection is empty. An empty catalogue is not a reliable signal that a tenant has never been initialized. A legitimate store with all products removed could be repopulated with demo data.

**New-platform response:** explicit tenant/store initialization state and a one-time bootstrap command with server-side idempotency. Never infer initialization from an ordinary business collection being empty.

### L-07 — Restore is multi-batch, not atomic (high)

Backup restore replaces collections in multiple Firestore batches. The user interface downloads a pre-restore export, but the database replacement itself is not one atomic transaction and can be interrupted part-way through.

**New-platform response:** staged restore, full validation, versioned import job, checksums, resumability, rollback snapshot, and post-restore reconciliation.

### L-08 — Unbounded live collection loading (medium/high)

The provider subscribes to every document in every collection. The architecture notes the scaling/cost concern. This is not a sustainable long-term query and reporting model.

**New-platform response:** bounded, paginated queries, indexed read models, and server-side reporting aggregates where justified.

### L-09 — UI state updater performs persistence side effects (medium)

The generic `update` path initiates asynchronous writes from inside a React state updater. State updater functions should remain pure; persistence belongs in an explicit command/action layer. This pattern complicates retries, concurrency, and predictable testing.

**New-platform response:** explicit application commands with typed results; UI state is not the persistence command bus.

### L-10 — Financial policy is under-specified for broader jurisdictions (high)

The legacy app uses integer Toman amounts and client-computed reports. It does not establish a jurisdiction-neutral currency model, formal tax policy, fiscal-period locking, or complete supplier/customer subledgers.

**New-platform response:** confirm jurisdiction, currency precision, tax policy, fiscal calendar, rounding, and legal reporting scope before implementing accounting.

## 5. Important product scope gaps

The legacy architecture explicitly lists these as not implemented:

- Full supplier and purchasing lifecycle, supplier payables, and purchase credit.
- Customer accounts and credit sales.
- Fiscal-period close/lock and formal tax reporting.
- Multi-store operation and distinct user roles.
- Server-authoritative financial reporting.

These are discovery decisions, not automatic MVP commitments.

## 6. Migration policy

1. Keep this source as a read-only reference until its provenance and data format are recorded.
2. Do not copy legacy Firebase persistence or trust assumptions into the new platform.
3. Port domain behavior only after a named rule, test, and acceptance case are approved.
4. Build golden test vectors for pricing, discount allocation, returns, COGS, shift cash, and financial statements.
5. Define a one-way, versioned migration/import tool. Reconcile counts and monetary totals before accepting imported data.
6. Preserve original backups. Never modify the only copy of legacy production data during migration testing.

## 7. Gate before implementation

- [ ] Confirm first market/jurisdiction and accounting/tax requirements.
- [ ] Confirm whether first release needs single-store or multi-store.
- [ ] Define offline command policy and terminal count.
- [ ] Define supplier/customer account scope.
- [ ] Approve currency and quantity precision rules.
- [ ] Establish a pilot operator and real workflows.
- [ ] Freeze a sanitized legacy source snapshot and its SHA-256 inventory.

## 8. Audit conclusion

The legacy application contains valuable, tested domain behavior and a meaningful breadth of retail workflows. Its current client-centric Firebase architecture is not a safe foundation for a multi-user financial platform. The new repository should preserve domain knowledge while replacing the trust, persistence, tenancy, synchronization, and restore architecture.
