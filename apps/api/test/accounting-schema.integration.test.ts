import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { PoolClient } from "pg";
import test from "node:test";
import { runMigrations } from "../scripts/migrate";
import { DatabaseService } from "../src/database/database.service";
import { TenantBootstrapService } from "../src/tenancy/tenant-bootstrap.service";

const migrationUrl = process.env.DATABASE_URL_MIGRATION;
const runtimeUrl = process.env.DATABASE_URL;
const enabled = Boolean(migrationUrl && runtimeUrl);

type DbError = Error & { code?: string };
type RoleName = "marketfa_accounting_owner" | "marketfa_app";

test(
  "accounting schema enforces tenant/store scope, period, posting, reversal, and immutability invariants",
  { skip: !enabled },
  async () => {
    await runMigrations();
    const ownerDb = new Pool({ connectionString: migrationUrl, max: 1 });
    const raceDb = new Pool({ connectionString: migrationUrl, max: 4 });
    const runtimeDb = new Pool({ connectionString: runtimeUrl, max: 4 });
    const ownerId = randomUUID();
    const secondOwnerId = randomUUID();
    const tenantIds: string[] = [];

    async function withRole<T>(
      role: RoleName,
      tenantId: string,
      work: (client: PoolClient) => Promise<T>,
    ): Promise<T> {
      const client = await ownerDb.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL ROLE ${role}`);
        await client.query(
          "SELECT set_config('app.current_tenant_id', $1, true)",
          [tenantId],
        );
        const value = await work(client);
        await client.query("COMMIT");
        return value;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }

    async function expectSqlState(
      action: () => Promise<unknown>,
      code: string,
    ): Promise<void> {
      await assert.rejects(action, (error: unknown) => {
        return (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as DbError).code === code
        );
      });
    }

    async function createDraftJournal(args: {
      tenantId: string;
      storeId: string;
      periodId: string;
      createdBy: string;
      id?: string;
      reversesEntryId?: string | null;
      idempotencyKey: string;
      sourceType?: string;
      postingPurpose?: string;
      entryDate?: string;
      sourceId?: string | null;
      postingRuleVersionId?: string | null;
    }): Promise<string> {
      const id = args.id ?? randomUUID();
      await withRole("marketfa_accounting_owner", args.tenantId, (client) =>
        client.query(
          `INSERT INTO journal_entries
            (id, tenant_id, store_id, period_id, entry_date, status, source_type,
             source_id, posting_purpose, posting_rule_version_id, idempotency_key,
             reverses_entry_id, created_by_user_id)
           VALUES ($1, $2, $3, $4, $5::date, 'DRAFT', $6,
                   $7, $8, $9, $10, $11, $12)`,
          [
            id,
            args.tenantId,
            args.storeId,
            args.periodId,
            args.entryDate ?? "2026-01-10",
            args.sourceType ?? "MANUAL",
            args.sourceId ?? null,
            args.postingPurpose ?? "manual",
            args.postingRuleVersionId ?? null,
            args.idempotencyKey,
            args.reversesEntryId ?? null,
            args.createdBy,
          ],
        ),
      );
      return id;
    }

    async function insertLine(args: {
      tenantId: string;
      storeId: string;
      journalId: string;
      lineNumber: number;
      accountId: string;
      accountCode: string;
      accountNameKey: string;
      accountType: string;
      normalBalance: string;
      debit: number;
      credit: number;
      dimensions?: unknown;
    }): Promise<void> {
      await withRole("marketfa_accounting_owner", args.tenantId, (client) =>
        client.query(
          `INSERT INTO journal_lines
            (tenant_id, store_id, journal_entry_id, line_number, account_id,
             account_code_snapshot, account_name_key_snapshot, account_type_snapshot,
             normal_balance_snapshot, debit_irr, credit_irr, dimensions)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            args.tenantId,
            args.storeId,
            args.journalId,
            args.lineNumber,
            args.accountId,
            args.accountCode,
            args.accountNameKey,
            args.accountType,
            args.normalBalance,
            args.debit,
            args.credit,
            args.dimensions ?? null,
          ],
        ),
      );
    }

    async function postJournal(args: {
      tenantId: string;
      journalId: string;
      entryNumber: number;
      postedBy: string;
    }): Promise<void> {
      await withRole("marketfa_accounting_owner", args.tenantId, (client) =>
        client.query(
          `UPDATE journal_entries
           SET status = 'POSTED', entry_number = $3,
               posted_at = now(), posted_by_user_id = $4
           WHERE tenant_id = $1 AND id = $2`,
          [args.tenantId, args.journalId, args.entryNumber, args.postedBy],
        ),
      );
    }

    try {
      await ownerDb.query(
        "INSERT INTO users (id, display_name, status) VALUES ($1, 'Accounting Owner A', 'ACTIVE'), ($2, 'Accounting Owner B', 'ACTIVE')",
        [ownerId, secondOwnerId],
      );
      const bootstrap = new TenantBootstrapService(
        new DatabaseService(runtimeDb),
      );
      const tenantA = await bootstrap.create(
        { userId: ownerId },
        { displayName: "Accounting A", legalName: null, storeName: "Store A" },
      );
      const tenantB = await bootstrap.create(
        { userId: secondOwnerId },
        { displayName: "Accounting B", legalName: null, storeName: "Store B" },
      );
      tenantIds.push(tenantA.tenantId, tenantB.tenantId);

      const storeA2 = randomUUID();
      await ownerDb.query(
        `INSERT INTO stores
          (id, tenant_id, name, timezone, default_locale, currency_code, money_display_unit)
         VALUES ($1, $2, 'Store A2', 'Asia/Tehran', 'fa-IR', 'IRR', 'TOMAN')`,
        [storeA2, tenantA.tenantId],
      );

      const accounts = await withRole(
        "marketfa_accounting_owner",
        tenantA.tenantId,
        async (client) => {
          const cash = await client.query<{ id: string }>(
            `INSERT INTO accounts
              (tenant_id, store_id, code, name_key, account_type, normal_balance,
               is_postable, status, created_by_user_id)
             VALUES ($1, $2, '1000', 'account.cash', 'ASSET', 'DEBIT',
                     TRUE, 'ACTIVE', $3)
             RETURNING id`,
            [tenantA.tenantId, tenantA.storeId, ownerId],
          );
          const revenue = await client.query<{ id: string }>(
            `INSERT INTO accounts
              (tenant_id, store_id, code, name_key, account_type, normal_balance,
               is_postable, status, created_by_user_id)
             VALUES ($1, $2, '4000', 'account.revenue', 'REVENUE', 'CREDIT',
                     TRUE, 'ACTIVE', $3)
             RETURNING id`,
            [tenantA.tenantId, tenantA.storeId, ownerId],
          );
          const otherStoreAccount = await client.query<{ id: string }>(
            `INSERT INTO accounts
              (tenant_id, store_id, code, name_key, account_type, normal_balance,
               is_postable, status, created_by_user_id)
             VALUES ($1, $2, '1000', 'account.cash.other', 'ASSET', 'DEBIT',
                     TRUE, 'ACTIVE', $3)
             RETURNING id`,
            [tenantA.tenantId, storeA2, ownerId],
          );
          const period = await client.query<{ id: string }>(
            `INSERT INTO fiscal_periods
              (tenant_id, store_id, name, start_date, end_date, status)
             VALUES ($1, $2, '2026-01', DATE '2026-01-01', DATE '2026-01-31', 'OPEN')
             RETURNING id`,
            [tenantA.tenantId, tenantA.storeId],
          );
          const adjacent = await client.query<{ id: string }>(
            `INSERT INTO fiscal_periods
              (tenant_id, store_id, name, start_date, end_date, status)
             VALUES ($1, $2, '2026-02', DATE '2026-02-01', DATE '2026-02-28', 'OPEN')
             RETURNING id`,
            [tenantA.tenantId, tenantA.storeId],
          );
          return {
            cashId: cash.rows[0]!.id,
            revenueId: revenue.rows[0]!.id,
            otherStoreAccountId: otherStoreAccount.rows[0]!.id,
            periodId: period.rows[0]!.id,
            adjacentPeriodId: adjacent.rows[0]!.id,
          };
        },
      );

      await expectSqlState(
        () =>
          withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
            client.query(
              `INSERT INTO fiscal_periods
                (tenant_id, store_id, name, start_date, end_date, status)
               VALUES ($1, $2, 'overlap', DATE '2026-01-15', DATE '2026-02-15', 'OPEN')`,
              [tenantA.tenantId, tenantA.storeId],
            ),
          ),
        "23P01",
      );

      const groupAccount = await withRole(
        "marketfa_accounting_owner",
        tenantA.tenantId,
        async (client) => {
          const result = await client.query<{ id: string }>(
            `INSERT INTO accounts
              (tenant_id, store_id, code, name_key, account_type, normal_balance,
               is_postable, status, created_by_user_id)
             VALUES ($1, $2, '1100', 'account.cash.group', 'ASSET', 'DEBIT',
                     FALSE, 'ACTIVE', $3)
             RETURNING id`,
            [tenantA.tenantId, tenantA.storeId, ownerId],
          );
          return result.rows[0]!.id;
        },
      );
      const childAccount = await withRole(
        "marketfa_accounting_owner",
        tenantA.tenantId,
        async (client) => {
          const result = await client.query<{ id: string }>(
            `INSERT INTO accounts
              (tenant_id, store_id, code, name_key, account_type, normal_balance,
               parent_account_id, is_postable, status, created_by_user_id)
             VALUES ($1, $2, '1101', 'account.cash.drawer', 'ASSET', 'DEBIT',
                     $3, FALSE, 'ACTIVE', $4)
             RETURNING id`,
            [tenantA.tenantId, tenantA.storeId, groupAccount, ownerId],
          );
          return result.rows[0]!.id;
        },
      );
      await expectSqlState(
        () =>
          withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
            client.query(
              "UPDATE accounts SET is_postable = TRUE WHERE tenant_id = $1 AND id = $2",
              [tenantA.tenantId, groupAccount],
            ),
          ),
        "23514",
      );
      await expectSqlState(
        () =>
          withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
            client.query(
              "UPDATE accounts SET parent_account_id = $3 WHERE tenant_id = $1 AND id = $2",
              [tenantA.tenantId, groupAccount, childAccount],
            ),
          ),
        "23514",
      );
      await expectSqlState(
        () =>
          withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
            client.query(
              `INSERT INTO accounts
                (tenant_id, store_id, code, name_key, account_type, normal_balance,
                 parent_account_id, is_postable, status, created_by_user_id)
               VALUES ($1, $2, '1999', 'account.bad.parent', 'ASSET', 'DEBIT',
                       $3, TRUE, 'ACTIVE', $4)`,
              [
                tenantA.tenantId,
                tenantA.storeId,
                accounts.otherStoreAccountId,
                ownerId,
              ],
            ),
          ),
        "23503",
      );

      const ruleId = randomUUID();
      await withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
        client.query(
          `INSERT INTO posting_rule_versions
            (id, tenant_id, store_id, rule_key, version, effective_from,
             configuration, status)
           VALUES ($1, $2, $3, 'manual.test', '1', DATE '2026-01-01',
                   '{"rule":"test"}'::jsonb, 'DRAFT')`,
          [ruleId, tenantA.tenantId, tenantA.storeId],
        ),
      );
      await withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
        client.query(
          `UPDATE posting_rule_versions
           SET status = 'APPROVED', approved_by_user_id = $2, approved_at = now()
           WHERE tenant_id = $1 AND id = $3`,
          [tenantA.tenantId, ownerId, ruleId],
        ),
      );
      await expectSqlState(
        () =>
          withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
            client.query(
              "UPDATE posting_rule_versions SET configuration = '{}'::jsonb WHERE tenant_id = $1 AND id = $2",
              [tenantA.tenantId, ruleId],
            ),
          ),
        "55000",
      );
      await expectSqlState(
        () =>
          withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
            client.query(
              "UPDATE posting_rule_versions SET approved_at = approved_at + interval '1 second' WHERE tenant_id = $1 AND id = $2",
              [tenantA.tenantId, ruleId],
            ),
          ),
        "55000",
      );
      await withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
        client.query(
          "UPDATE posting_rule_versions SET status = 'RETIRED' WHERE tenant_id = $1 AND id = $2",
          [tenantA.tenantId, ruleId],
        ),
      );
      await expectSqlState(
        () =>
          withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
            client.query(
              "UPDATE posting_rule_versions SET effective_to = DATE '2026-12-31' WHERE tenant_id = $1 AND id = $2",
              [tenantA.tenantId, ruleId],
            ),
          ),
        "55000",
      );

      const originalId = await createDraftJournal({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        periodId: accounts.periodId,
        createdBy: ownerId,
        idempotencyKey: "sale-test-001",
      });
      await insertLine({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        journalId: originalId,
        lineNumber: 1,
        accountId: accounts.cashId,
        accountCode: "1000",
        accountNameKey: "account.cash",
        accountType: "ASSET",
        normalBalance: "DEBIT",
        debit: 1000,
        credit: 0,
        dimensions: { terminal: "t-1" },
      });
      await insertLine({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        journalId: originalId,
        lineNumber: 2,
        accountId: accounts.revenueId,
        accountCode: "4000",
        accountNameKey: "account.revenue",
        accountType: "REVENUE",
        normalBalance: "CREDIT",
        debit: 0,
        credit: 1000,
        dimensions: { terminal: "t-1" },
      });
      await postJournal({
        tenantId: tenantA.tenantId,
        journalId: originalId,
        entryNumber: 1,
        postedBy: ownerId,
      });

      await withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
        client.query(
          "INSERT INTO accounting_sequences (tenant_id, store_id, next_entry_number) VALUES ($1, $2, 2)",
          [tenantA.tenantId, tenantA.storeId],
        ),
      );
      await expectSqlState(
        () =>
          createDraftJournal({
            tenantId: tenantA.tenantId,
            storeId: tenantA.storeId,
            periodId: accounts.periodId,
            createdBy: ownerId,
            idempotencyKey: "sale-test-001",
          }),
        "23505",
      );

      await expectSqlState(
        () =>
          withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
            client.query(
              "UPDATE accounts SET normal_balance = 'CREDIT' WHERE tenant_id = $1 AND id = $2",
              [tenantA.tenantId, accounts.cashId],
            ),
          ),
        "55000",
      );
      await expectSqlState(
        () =>
          withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
            client.query(
              "UPDATE journal_entries SET description = 'tampered' WHERE tenant_id = $1 AND id = $2",
              [tenantA.tenantId, originalId],
            ),
          ),
        "55000",
      );
      await expectSqlState(
        () =>
          withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
            client.query(
              "UPDATE journal_lines SET debit_irr = 999 WHERE tenant_id = $1 AND journal_entry_id = $2 AND line_number = 1",
              [tenantA.tenantId, originalId],
            ),
          ),
        "55000",
      );
      await expectSqlState(
        () =>
          withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
            client.query(
              "DELETE FROM journal_lines WHERE tenant_id = $1 AND journal_entry_id = $2 AND line_number = 1",
              [tenantA.tenantId, originalId],
            ),
          ),
        "55000",
      );

      const badReversalId = await createDraftJournal({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        periodId: accounts.periodId,
        createdBy: ownerId,
        idempotencyKey: "reversal-bad-001",
        reversesEntryId: originalId,
      });
      await insertLine({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        journalId: badReversalId,
        lineNumber: 1,
        accountId: accounts.cashId,
        accountCode: "1000",
        accountNameKey: "account.cash",
        accountType: "ASSET",
        normalBalance: "DEBIT",
        debit: 0,
        credit: 900,
        dimensions: { terminal: "t-1" },
      });
      await insertLine({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        journalId: badReversalId,
        lineNumber: 2,
        accountId: accounts.revenueId,
        accountCode: "4000",
        accountNameKey: "account.revenue",
        accountType: "REVENUE",
        normalBalance: "CREDIT",
        debit: 900,
        credit: 0,
        dimensions: { terminal: "t-1" },
      });
      await expectSqlState(
        () =>
          postJournal({
            tenantId: tenantA.tenantId,
            journalId: badReversalId,
            entryNumber: 2,
            postedBy: ownerId,
          }),
        "23514",
      );
      await withRole(
        "marketfa_accounting_owner",
        tenantA.tenantId,
        async (client) => {
          await client.query(
            "DELETE FROM journal_lines WHERE tenant_id = $1 AND journal_entry_id = $2",
            [tenantA.tenantId, badReversalId],
          );
          await client.query(
            "DELETE FROM journal_entries WHERE tenant_id = $1 AND id = $2",
            [tenantA.tenantId, badReversalId],
          );
        },
      );

      const reversalId = await createDraftJournal({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        periodId: accounts.periodId,
        createdBy: ownerId,
        idempotencyKey: "reversal-good-001",
        reversesEntryId: originalId,
      });
      await insertLine({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        journalId: reversalId,
        lineNumber: 1,
        accountId: accounts.cashId,
        accountCode: "1000",
        accountNameKey: "account.cash",
        accountType: "ASSET",
        normalBalance: "DEBIT",
        debit: 0,
        credit: 1000,
        dimensions: { terminal: "t-1" },
      });
      await insertLine({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        journalId: reversalId,
        lineNumber: 2,
        accountId: accounts.revenueId,
        accountCode: "4000",
        accountNameKey: "account.revenue",
        accountType: "REVENUE",
        normalBalance: "CREDIT",
        debit: 1000,
        credit: 0,
        dimensions: { terminal: "t-1" },
      });
      await postJournal({
        tenantId: tenantA.tenantId,
        journalId: reversalId,
        entryNumber: 2,
        postedBy: ownerId,
      });

      await expectSqlState(
        () =>
          createDraftJournal({
            tenantId: tenantA.tenantId,
            storeId: tenantA.storeId,
            periodId: accounts.periodId,
            createdBy: ownerId,
            idempotencyKey: "reversal-duplicate-001",
            reversesEntryId: originalId,
          }),
        "23505",
      );

      const saleRuleId = randomUUID();
      await withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
        client.query(
          `INSERT INTO posting_rule_versions
            (id, tenant_id, store_id, rule_key, version, effective_from,
             effective_to, configuration, status)
           VALUES ($1, $2, $3, 'sale.posting', '1', DATE '2026-01-01',
                   DATE '2026-01-31', '{"rule":"sale"}'::jsonb, 'DRAFT')`,
          [saleRuleId, tenantA.tenantId, tenantA.storeId],
        ),
      );
      await withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
        client.query(
          `UPDATE posting_rule_versions
           SET status = 'APPROVED', approved_by_user_id = $2, approved_at = now()
           WHERE tenant_id = $1 AND id = $3`,
          [tenantA.tenantId, ownerId, saleRuleId],
        ),
      );
      const saleSourceId = randomUUID();
      const saleJournalId = await createDraftJournal({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        periodId: accounts.periodId,
        createdBy: ownerId,
        idempotencyKey: "sale-source-001",
        sourceType: "SALE",
        sourceId: saleSourceId,
        postingPurpose: "sale",
        postingRuleVersionId: saleRuleId,
      });
      await insertLine({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        journalId: saleJournalId,
        lineNumber: 1,
        accountId: accounts.cashId,
        accountCode: "1000",
        accountNameKey: "account.cash",
        accountType: "ASSET",
        normalBalance: "DEBIT",
        debit: 200,
        credit: 0,
      });
      await insertLine({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        journalId: saleJournalId,
        lineNumber: 2,
        accountId: accounts.revenueId,
        accountCode: "4000",
        accountNameKey: "account.revenue",
        accountType: "REVENUE",
        normalBalance: "CREDIT",
        debit: 0,
        credit: 200,
      });
      await postJournal({
        tenantId: tenantA.tenantId,
        journalId: saleJournalId,
        entryNumber: 3,
        postedBy: ownerId,
      });
      await withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
        client.query(
          "UPDATE accounting_sequences SET next_entry_number = 4 WHERE tenant_id = $1 AND store_id = $2",
          [tenantA.tenantId, tenantA.storeId],
        ),
      );
      await expectSqlState(
        () =>
          createDraftJournal({
            tenantId: tenantA.tenantId,
            storeId: tenantA.storeId,
            periodId: accounts.periodId,
            createdBy: ownerId,
            idempotencyKey: "sale-source-duplicate",
            sourceType: "SALE",
            sourceId: saleSourceId,
            postingPurpose: "sale",
            postingRuleVersionId: saleRuleId,
          }),
        "23505",
      );

      const futureRuleId = randomUUID();
      await withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
        client.query(
          `INSERT INTO posting_rule_versions
            (id, tenant_id, store_id, rule_key, version, effective_from,
             configuration, status)
           VALUES ($1, $2, $3, 'sale.future', '1', DATE '2026-02-01',
                   '{"rule":"future"}'::jsonb, 'DRAFT')`,
          [futureRuleId, tenantA.tenantId, tenantA.storeId],
        ),
      );
      await withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
        client.query(
          `UPDATE posting_rule_versions
           SET status = 'APPROVED', approved_by_user_id = $2, approved_at = now()
           WHERE tenant_id = $1 AND id = $3`,
          [tenantA.tenantId, ownerId, futureRuleId],
        ),
      );
      const futureSourceId = randomUUID();
      const futureRuleJournalId = await createDraftJournal({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        periodId: accounts.periodId,
        createdBy: ownerId,
        idempotencyKey: "sale-future-rule-001",
        sourceType: "SALE",
        sourceId: futureSourceId,
        postingPurpose: "sale",
        postingRuleVersionId: futureRuleId,
      });
      await insertLine({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        journalId: futureRuleJournalId,
        lineNumber: 1,
        accountId: accounts.cashId,
        accountCode: "1000",
        accountNameKey: "account.cash",
        accountType: "ASSET",
        normalBalance: "DEBIT",
        debit: 50,
        credit: 0,
      });
      await insertLine({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        journalId: futureRuleJournalId,
        lineNumber: 2,
        accountId: accounts.revenueId,
        accountCode: "4000",
        accountNameKey: "account.revenue",
        accountType: "REVENUE",
        normalBalance: "CREDIT",
        debit: 0,
        credit: 50,
      });
      await expectSqlState(
        () =>
          postJournal({
            tenantId: tenantA.tenantId,
            journalId: futureRuleJournalId,
            entryNumber: 4,
            postedBy: ownerId,
          }),
        "23514",
      );

      await expectSqlState(
        () =>
          createDraftJournal({
            tenantId: tenantA.tenantId,
            storeId: tenantA.storeId,
            periodId: accounts.periodId,
            createdBy: ownerId,
            idempotencyKey: "cross-store-line-001",
          }).then(async (journalId) => {
            await insertLine({
              tenantId: tenantA.tenantId,
              storeId: tenantA.storeId,
              journalId,
              lineNumber: 1,
              accountId: accounts.otherStoreAccountId,
              accountCode: "1000",
              accountNameKey: "account.cash.other",
              accountType: "ASSET",
              normalBalance: "DEBIT",
              debit: 10,
              credit: 0,
            });
          }),
        "23503",
      );

      await expectSqlState(
        () =>
          createDraftJournal({
            tenantId: tenantA.tenantId,
            storeId: tenantA.storeId,
            periodId: accounts.periodId,
            createdBy: ownerId,
            idempotencyKey: "invalid-line-side-001",
          }).then(async (journalId) => {
            await insertLine({
              tenantId: tenantA.tenantId,
              storeId: tenantA.storeId,
              journalId,
              lineNumber: 1,
              accountId: accounts.cashId,
              accountCode: "1000",
              accountNameKey: "account.cash",
              accountType: "ASSET",
              normalBalance: "DEBIT",
              debit: 10,
              credit: 10,
            });
          }),
        "23514",
      );

      const outOfPeriodId = await createDraftJournal({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        periodId: accounts.periodId,
        createdBy: ownerId,
        idempotencyKey: "out-of-period-001",
        entryDate: "2026-02-01",
      });
      await insertLine({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        journalId: outOfPeriodId,
        lineNumber: 1,
        accountId: accounts.cashId,
        accountCode: "1000",
        accountNameKey: "account.cash",
        accountType: "ASSET",
        normalBalance: "DEBIT",
        debit: 100,
        credit: 0,
      });
      await insertLine({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        journalId: outOfPeriodId,
        lineNumber: 2,
        accountId: accounts.revenueId,
        accountCode: "4000",
        accountNameKey: "account.revenue",
        accountType: "REVENUE",
        normalBalance: "CREDIT",
        debit: 0,
        credit: 100,
      });
      await expectSqlState(
        () =>
          postJournal({
            tenantId: tenantA.tenantId,
            journalId: outOfPeriodId,
            entryNumber: 99,
            postedBy: ownerId,
          }),
        "23514",
      );

      const closedPeriod = await withRole(
        "marketfa_accounting_owner",
        tenantA.tenantId,
        async (client) => {
          const result = await client.query<{ id: string }>(
            `INSERT INTO fiscal_periods
              (tenant_id, store_id, name, start_date, end_date, status,
               closed_at, closed_by_user_id)
             VALUES ($1, $2, 'closed-2025', DATE '2025-01-01', DATE '2025-12-31',
                     'CLOSED', now(), $3)
             RETURNING id`,
            [tenantA.tenantId, tenantA.storeId, ownerId],
          );
          return result.rows[0]!.id;
        },
      );
      const closedJournalId = await createDraftJournal({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        periodId: closedPeriod,
        createdBy: ownerId,
        idempotencyKey: "closed-period-001",
      });
      await insertLine({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        journalId: closedJournalId,
        lineNumber: 1,
        accountId: accounts.cashId,
        accountCode: "1000",
        accountNameKey: "account.cash",
        accountType: "ASSET",
        normalBalance: "DEBIT",
        debit: 100,
        credit: 0,
      });
      await insertLine({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        journalId: closedJournalId,
        lineNumber: 2,
        accountId: accounts.revenueId,
        accountCode: "4000",
        accountNameKey: "account.revenue",
        accountType: "REVENUE",
        normalBalance: "CREDIT",
        debit: 0,
        credit: 100,
      });
      await expectSqlState(
        () =>
          postJournal({
            tenantId: tenantA.tenantId,
            journalId: closedJournalId,
            entryNumber: 100,
            postedBy: ownerId,
          }),
        "55000",
      );

      // Serialize journal-line mutation against posting on the same parent row.
      const raceJournalId = await createDraftJournal({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        periodId: accounts.periodId,
        createdBy: ownerId,
        idempotencyKey: "posting-line-race-001",
      });
      await insertLine({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        journalId: raceJournalId,
        lineNumber: 1,
        accountId: accounts.cashId,
        accountCode: "1000",
        accountNameKey: "account.cash",
        accountType: "ASSET",
        normalBalance: "DEBIT",
        debit: 100,
        credit: 0,
      });
      await insertLine({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        journalId: raceJournalId,
        lineNumber: 2,
        accountId: accounts.revenueId,
        accountCode: "4000",
        accountNameKey: "account.revenue",
        accountType: "REVENUE",
        normalBalance: "CREDIT",
        debit: 0,
        credit: 100,
      });

      const lineClient = await raceDb.connect();
      const postClient = await raceDb.connect();
      try {
        await lineClient.query("BEGIN");
        await lineClient.query("SET LOCAL ROLE marketfa_accounting_owner");
        await lineClient.query(
          "SELECT set_config('app.current_tenant_id', $1, true)",
          [tenantA.tenantId],
        );
        await lineClient.query(
          `INSERT INTO journal_lines
            (tenant_id, store_id, journal_entry_id, line_number, account_id,
             account_code_snapshot, account_name_key_snapshot, account_type_snapshot,
             normal_balance_snapshot, debit_irr, credit_irr)
           VALUES
            ($1, $2, $3, 3, $4, '1000', 'account.cash', 'ASSET', 'DEBIT', 10, 0),
            ($1, $2, $3, 4, $5, '4000', 'account.revenue', 'REVENUE', 'CREDIT', 0, 10)`,
          [
            tenantA.tenantId,
            tenantA.storeId,
            raceJournalId,
            accounts.cashId,
            accounts.revenueId,
          ],
        );

        await postClient.query("BEGIN");
        await postClient.query("SET LOCAL ROLE marketfa_accounting_owner");
        await postClient.query(
          "SELECT set_config('app.current_tenant_id', $1, true)",
          [tenantA.tenantId],
        );
        const postPidResult = await postClient.query<{ pid: number }>(
          "SELECT pg_backend_pid() AS pid",
        );
        const postPid = postPidResult.rows[0]!.pid;
        const postPromise = postClient.query(
          `UPDATE journal_entries
           SET status = 'POSTED', entry_number = 10,
               posted_at = now(), posted_by_user_id = $3
           WHERE tenant_id = $1 AND id = $2`,
          [tenantA.tenantId, raceJournalId, ownerId],
        );

        let observedLock = false;
        for (let attempt = 0; attempt < 100; attempt += 1) {
          const activity = await ownerDb.query<{ waiting: boolean }>(
            "SELECT wait_event_type = 'Lock' AS waiting FROM pg_stat_activity WHERE pid = $1",
            [postPid],
          );
          if (activity.rows[0]?.waiting) {
            observedLock = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        assert.equal(
          observedLock,
          true,
          "posting must wait while a line mutation holds the journal row lock",
        );

        await lineClient.query("COMMIT");
        await postPromise;
        await postClient.query("COMMIT");
      } catch (error) {
        await lineClient.query("ROLLBACK").catch(() => undefined);
        await postClient.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        lineClient.release();
        postClient.release();
      }

      // If posting owns the parent row first, a later line write must wait
      // and then fail after the committed POSTED state becomes visible.
      const postedFirstJournalId = await createDraftJournal({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        periodId: accounts.periodId,
        createdBy: ownerId,
        idempotencyKey: "posting-line-race-002",
      });
      await insertLine({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        journalId: postedFirstJournalId,
        lineNumber: 1,
        accountId: accounts.cashId,
        accountCode: "1000",
        accountNameKey: "account.cash",
        accountType: "ASSET",
        normalBalance: "DEBIT",
        debit: 200,
        credit: 0,
      });
      await insertLine({
        tenantId: tenantA.tenantId,
        storeId: tenantA.storeId,
        journalId: postedFirstJournalId,
        lineNumber: 2,
        accountId: accounts.revenueId,
        accountCode: "4000",
        accountNameKey: "account.revenue",
        accountType: "REVENUE",
        normalBalance: "CREDIT",
        debit: 0,
        credit: 200,
      });

      const postedFirstPostClient = await raceDb.connect();
      const postedFirstLineClient = await raceDb.connect();
      try {
        await postedFirstPostClient.query("BEGIN");
        await postedFirstPostClient.query(
          "SET LOCAL ROLE marketfa_accounting_owner",
        );
        await postedFirstPostClient.query(
          "SELECT set_config('app.current_tenant_id', $1, true)",
          [tenantA.tenantId],
        );
        await postedFirstPostClient.query(
          `UPDATE journal_entries
           SET status = 'POSTED', entry_number = 11,
               posted_at = now(), posted_by_user_id = $3
           WHERE tenant_id = $1 AND id = $2`,
          [tenantA.tenantId, postedFirstJournalId, ownerId],
        );

        await postedFirstLineClient.query("BEGIN");
        await postedFirstLineClient.query(
          "SET LOCAL ROLE marketfa_accounting_owner",
        );
        await postedFirstLineClient.query(
          "SELECT set_config('app.current_tenant_id', $1, true)",
          [tenantA.tenantId],
        );
        const linePidResult = await postedFirstLineClient.query<{ pid: number }>(
          "SELECT pg_backend_pid() AS pid",
        );
        const linePid = linePidResult.rows[0]!.pid;
        const lateLinePromise = postedFirstLineClient.query(
          `INSERT INTO journal_lines
            (tenant_id, store_id, journal_entry_id, line_number, account_id,
             account_code_snapshot, account_name_key_snapshot, account_type_snapshot,
             normal_balance_snapshot, debit_irr, credit_irr)
           VALUES ($1, $2, $3, 3, $4, '1000', 'account.cash', 'ASSET', 'DEBIT', 1, 0)`,
          [
            tenantA.tenantId,
            tenantA.storeId,
            postedFirstJournalId,
            accounts.cashId,
          ],
        ).then(
          () => null,
          (error: unknown) => (error as DbError).code ?? "UNKNOWN",
        );

        let observedLineLock = false;
        for (let attempt = 0; attempt < 100; attempt += 1) {
          const activity = await ownerDb.query<{ waiting: boolean }>(
            "SELECT wait_event_type = 'Lock' AS waiting FROM pg_stat_activity WHERE pid = $1",
            [linePid],
          );
          if (activity.rows[0]?.waiting) {
            observedLineLock = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        assert.equal(
          observedLineLock,
          true,
          "line mutation must wait while posting holds the journal row lock",
        );

        await postedFirstPostClient.query("COMMIT");
        assert.equal(await lateLinePromise, "55000");
        await postedFirstLineClient.query("ROLLBACK");
      } catch (error) {
        await postedFirstPostClient.query("ROLLBACK").catch(() => undefined);
        await postedFirstLineClient.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        postedFirstPostClient.release();
        postedFirstLineClient.release();
      }

      const auditId = randomUUID();
      await withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
        client.query(
          `INSERT INTO accounting_audit_events
            (id, tenant_id, store_id, actor_user_id, command_id, event_type,
             entity_type, entity_id, metadata)
           VALUES ($1, $2, $3, $4, $5, 'journal.post', 'journal_entry', $6, '{}'::jsonb)`,
          [
            auditId,
            tenantA.tenantId,
            tenantA.storeId,
            ownerId,
            randomUUID(),
            originalId,
          ],
        ),
      );
      await expectSqlState(
        () =>
          withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
            client.query(
              "UPDATE accounting_audit_events SET reason = 'tampered' WHERE tenant_id = $1 AND id = $2",
              [tenantA.tenantId, auditId],
            ),
          ),
        "55000",
      );
      await expectSqlState(
        () =>
          withRole("marketfa_accounting_owner", tenantA.tenantId, (client) =>
            client.query(
              "DELETE FROM accounting_audit_events WHERE tenant_id = $1 AND id = $2",
              [tenantA.tenantId, auditId],
            ),
          ),
        "55000",
      );

      const tenantBAccount = await withRole(
        "marketfa_accounting_owner",
        tenantB.tenantId,
        async (client) => {
          const result = await client.query<{ id: string }>(
            `INSERT INTO accounts
              (tenant_id, store_id, code, name_key, account_type, normal_balance,
               is_postable, status, created_by_user_id)
             VALUES ($1, $2, '1000', 'tenant.b.cash', 'ASSET', 'DEBIT',
                     TRUE, 'ACTIVE', $3)
             RETURNING id`,
            [tenantB.tenantId, tenantB.storeId, secondOwnerId],
          );
          return result.rows[0]!.id;
        },
      );
      assert.ok(tenantBAccount);

      const visible = await withRole(
        "marketfa_app",
        tenantA.tenantId,
        (client) =>
          client.query("SELECT id FROM accounts WHERE tenant_id = $1", [
            tenantB.tenantId,
          ]),
      );
      assert.equal(visible.rowCount, 0);

      await expectSqlState(
        () =>
          withRole("marketfa_app", tenantA.tenantId, (client) =>
            client.query(
              `INSERT INTO accounts
                (tenant_id, store_id, code, name_key, account_type, normal_balance,
                 is_postable, status, created_by_user_id)
               VALUES ($1, $2, '9999', 'runtime.write', 'ASSET', 'DEBIT',
                       TRUE, 'ACTIVE', $3)`,
              [tenantA.tenantId, tenantA.storeId, ownerId],
            ),
          ),
        "42501",
      );
    } finally {
      const cleanupClient = await ownerDb.connect();
      try {
        await cleanupClient.query("SET session_replication_role = replica");
        for (const tenantId of tenantIds) {
          await cleanupClient.query(
            "DELETE FROM accounting_audit_events WHERE tenant_id = $1",
            [tenantId],
          );
          await cleanupClient.query(
            "DELETE FROM journal_lines WHERE tenant_id = $1",
            [tenantId],
          );
          await cleanupClient.query(
            "DELETE FROM journal_entries WHERE tenant_id = $1",
            [tenantId],
          );
          await cleanupClient.query(
            "DELETE FROM accounting_sequences WHERE tenant_id = $1",
            [tenantId],
          );
          await cleanupClient.query(
            "DELETE FROM posting_rule_versions WHERE tenant_id = $1",
            [tenantId],
          );
          await cleanupClient.query(
            "DELETE FROM fiscal_periods WHERE tenant_id = $1",
            [tenantId],
          );
          await cleanupClient.query(
            "DELETE FROM accounts WHERE tenant_id = $1",
            [tenantId],
          );
          await cleanupClient.query(
            "DELETE FROM stores WHERE tenant_id = $1 AND name = 'Store A2'",
            [tenantId],
          );
          await cleanupClient.query(
            "DELETE FROM audit_events WHERE tenant_id = $1",
            [tenantId],
          );
          await cleanupClient.query(
            "DELETE FROM tenant_memberships WHERE tenant_id = $1",
            [tenantId],
          );
          await cleanupClient.query("DELETE FROM stores WHERE tenant_id = $1", [
            tenantId,
          ]);
          await cleanupClient.query("DELETE FROM tenants WHERE id = $1", [
            tenantId,
          ]);
        }
        await cleanupClient.query(
          "DELETE FROM users WHERE id = ANY($1::uuid[])",
          [[ownerId, secondOwnerId]],
        );
      } finally {
        await cleanupClient
          .query("SET session_replication_role = origin")
          .catch(() => undefined);
        cleanupClient.release();
      }
      await Promise.all([ownerDb.end(), raceDb.end(), runtimeDb.end()]);
    }
  },
);
