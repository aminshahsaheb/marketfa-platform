import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Pool } from "pg";
import test from "node:test";
import { runMigrations } from "../scripts/migrate";
import { DatabaseService } from "../src/database/database.service";
import { TenantBootstrapService } from "../src/tenancy/tenant-bootstrap.service";

const migrationUrl = process.env.DATABASE_URL_MIGRATION;
const runtimeUrl = process.env.DATABASE_URL;
const enabled = Boolean(migrationUrl && runtimeUrl);

test(
  "tenant bootstrap creates a profile, accounting book and generic location with an optional store",
  { skip: !enabled },
  async () => {
    await runMigrations();
    const owner = new Pool({ connectionString: migrationUrl, max: 1 });
    const runtime = new Pool({ connectionString: runtimeUrl, max: 2 });
    const activeUserId = randomUUID();
    const suspendedUserId = randomUUID();
    const tenantIds: string[] = [];

    try {
      await owner.query(
        "INSERT INTO users (id, display_name, status) VALUES ($1, 'Bootstrap User', 'ACTIVE'), ($2, 'Suspended User', 'SUSPENDED')",
        [activeUserId, suspendedUserId],
      );

      const database = new DatabaseService(runtime);
      const service = new TenantBootstrapService(database);
      const serviceBusiness = await service.create(
        { userId: activeUserId },
        {
          displayName: "Test Services",
          legalName: "Test Legal Name",
          locationName: "Main Office",
          storeName: null,
          industryId: "professional-services",
        },
      );
      tenantIds.push(serviceBusiness.tenantId);

      assert.equal(serviceBusiness.storeId, null);
      assert.ok(serviceBusiness.tenantId);
      assert.ok(serviceBusiness.ownerMembershipId);
      assert.ok(serviceBusiness.businessProfileId);
      assert.ok(serviceBusiness.businessLocationId);
      assert.ok(serviceBusiness.accountingBookId);

      const profile = await owner.query<{
        id: string;
        tenant_id: string;
        display_name: string;
        industry_key: string;
        industry_profile_version: number;
        accounting_book_id: string;
        created_by_user_id: string;
      }>(
        "SELECT id, tenant_id, display_name, industry_key, industry_profile_version, accounting_book_id, created_by_user_id FROM business_profiles WHERE id = $1",
        [serviceBusiness.businessProfileId],
      );
      assert.deepEqual(profile.rows[0], {
        id: serviceBusiness.businessProfileId,
        tenant_id: serviceBusiness.tenantId,
        display_name: "Test Services",
        industry_key: "professional-services",
        industry_profile_version: 1,
        accounting_book_id: serviceBusiness.accountingBookId,
        created_by_user_id: activeUserId,
      });

      const book = await owner.query<{
        id: string;
        tenant_id: string;
        name: string;
        currency_code: string;
      }>(
        "SELECT id, tenant_id, name, currency_code FROM accounting_books WHERE id = $1",
        [serviceBusiness.accountingBookId],
      );
      assert.deepEqual(book.rows[0], {
        id: serviceBusiness.accountingBookId,
        tenant_id: serviceBusiness.tenantId,
        name: "Test Services",
        currency_code: "IRR",
      });

      const capabilities = await owner.query<{
        capability_key: string;
        status: string;
      }>(
        "SELECT capability_key, status FROM business_profile_capabilities WHERE tenant_id = $1 AND business_profile_id = $2 ORDER BY capability_key",
        [serviceBusiness.tenantId, serviceBusiness.businessProfileId],
      );
      const capabilityStatuses = new Map(
        capabilities.rows.map((row) => [row.capability_key, row.status]),
      );
      assert.equal(capabilityStatuses.get("finance"), "SUGGESTED");
      assert.equal(capabilityStatuses.get("projects"), "SUGGESTED");
      assert.equal(capabilityStatuses.has("inventory"), false);
      assert.equal(capabilityStatuses.has("point_of_sale"), false);
      assert.equal(
        capabilities.rows.some((row) => row.status === "ENABLED"),
        false,
      );

      const location = await owner.query<{
        id: string;
        tenant_id: string;
        business_profile_id: string;
        name: string;
        location_type: string;
        store_id: string | null;
      }>(
        "SELECT id, tenant_id, business_profile_id, name, location_type, store_id FROM business_locations WHERE id = $1",
        [serviceBusiness.businessLocationId],
      );
      assert.deepEqual(location.rows[0], {
        id: serviceBusiness.businessLocationId,
        tenant_id: serviceBusiness.tenantId,
        business_profile_id: serviceBusiness.businessProfileId,
        name: "Main Office",
        location_type: "OTHER",
        store_id: null,
      });

      const retailBusiness = await service.create(
        { userId: activeUserId },
        {
          displayName: "Retail Test",
          legalName: null,
          locationName: "Main Branch",
          storeName: "Main Store",
          industryId: "general-retail",
        },
      );
      tenantIds.push(retailBusiness.tenantId);
      assert.ok(retailBusiness.storeId);
      const retailLocation = await owner.query<{
        store_id: string | null;
        business_profile_id: string;
      }>(
        "SELECT store_id, business_profile_id FROM business_locations WHERE id = $1",
        [retailBusiness.businessLocationId],
      );
      assert.deepEqual(retailLocation.rows[0], {
        store_id: retailBusiness.storeId,
        business_profile_id: retailBusiness.businessProfileId,
      });

      const pharmacyBusiness = await service.create(
        { userId: activeUserId },
        {
          displayName: "Pharmacy Test",
          legalName: null,
          locationName: "Pharmacy Location",
          storeName: null,
          industryId: "pharmacy",
        },
      );
      tenantIds.push(pharmacyBusiness.tenantId);
      assert.equal(pharmacyBusiness.storeId, null);
      const regulated = await owner.query<{ status: string }>(
        "SELECT status FROM business_profile_capabilities WHERE tenant_id = $1 AND business_profile_id = $2",
        [pharmacyBusiness.tenantId, pharmacyBusiness.businessProfileId],
      );
      assert.ok(regulated.rows.length > 0);
      assert.equal(
        regulated.rows.every((row) => row.status === "PENDING_APPROVAL"),
        true,
      );
      assert.equal(
        regulated.rows.some((row) => row.status === "ENABLED"),
        false,
      );

      await assert.rejects(
        service.create(
          { userId: activeUserId },
          {
            displayName: "Invalid Industry",
            legalName: null,
            locationName: "Office",
            storeName: null,
            industryId: "not-a-real-industry",
          },
        ),
        BadRequestException,
      );

      await assert.rejects(
        service.create(
          { userId: suspendedUserId },
          {
            displayName: "Should Not Exist",
            legalName: null,
            locationName: "Office",
            storeName: null,
            industryId: "professional-services",
          },
        ),
        ForbiddenException,
      );

      await assert.rejects(
        database.withAuthenticatedActor(
          { userId: activeUserId },
          async (client) =>
            client.query("SELECT * FROM public.tenant_bootstrap($1, $2, $3)", [
              "   ",
              null,
              "Store",
            ]),
        ),
      );
    } finally {
      for (const tenantId of tenantIds) {
        await owner.query("DELETE FROM audit_events WHERE tenant_id = $1", [
          tenantId,
        ]);
        await owner.query(
          "DELETE FROM business_locations WHERE tenant_id = $1",
          [tenantId],
        );
        await owner.query("DELETE FROM stores WHERE tenant_id = $1", [
          tenantId,
        ]);
        await owner.query(
          "DELETE FROM business_profile_capabilities WHERE tenant_id = $1",
          [tenantId],
        );
        await owner.query("DELETE FROM business_profiles WHERE tenant_id = $1", [
          tenantId,
        ]);
        await owner.query("DELETE FROM accounting_books WHERE tenant_id = $1", [
          tenantId,
        ]);
        await owner.query("DELETE FROM tenant_memberships WHERE tenant_id = $1", [
          tenantId,
        ]);
        await owner.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
      }
      await owner.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        [activeUserId, suspendedUserId],
      ]);
      await Promise.all([owner.end(), runtime.end()]);
    }
  },
);
