import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import test from "node:test";
import { TenantBootstrapController } from "../src/tenancy/tenant-bootstrap.controller";
import type { TenantBootstrapService } from "../src/tenancy/tenant-bootstrap.service";

test("tenant bootstrap requires a valid industry selection", async () => {
  const calls: unknown[] = [];
  const service = {
    create: async (_actor: unknown, input: unknown) => {
      calls.push(input);
      return {
        tenantId: "tenant-1",
        storeId: "store-1",
        ownerMembershipId: "membership-1",
        businessProfileId: "business-profile-1",
      };
    },
  };
  const controller = new TenantBootstrapController(
    service as unknown as TenantBootstrapService,
  );
  const actor = { userId: "user-1", sessionId: "session-1" };

  assert.throws(
    () => controller.create(actor, { displayName: " ", storeName: "Main" }),
    BadRequestException,
  );
  assert.throws(
    () =>
      controller.create(actor, {
        displayName: "Business",
        storeName: "Main",
        industryId: 42,
      }),
    BadRequestException,
  );
  assert.throws(
    () =>
      controller.create(actor, {
        displayName: "Business",
        storeName: "Main",
      }),
    BadRequestException,
  );

  await controller.create(actor, {
    displayName: "  Business  ",
    legalName: "  Legal Name ",
    storeName: " Main Store ",
    industryId: " professional-services ",
  });

  assert.deepEqual(calls, [
    {
      displayName: "Business",
      legalName: "Legal Name",
      storeName: "Main Store",
      industryId: "professional-services",
    },
  ]);
});
