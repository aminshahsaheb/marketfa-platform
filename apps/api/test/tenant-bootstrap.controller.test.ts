import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import test from "node:test";
import { TenantBootstrapController } from "../src/tenancy/tenant-bootstrap.controller";
import type { TenantBootstrapService } from "../src/tenancy/tenant-bootstrap.service";

test("tenant bootstrap supports generic locations and optional retail stores", async () => {
  const calls: unknown[] = [];
  const service = {
    create: async (_actor: unknown, input: unknown) => {
      calls.push(input);
      return {
        tenantId: "tenant-1",
        storeId: null,
        ownerMembershipId: "membership-1",
        businessProfileId: "business-profile-1",
        businessLocationId: "business-location-1",
        accountingBookId: "accounting-book-1",
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
        locationName: "Office",
        industryId: 42,
      }),
    BadRequestException,
  );
  assert.throws(
    () =>
      controller.create(actor, {
        displayName: "Business",
        industryId: "professional-services",
      }),
    BadRequestException,
  );

  // Existing clients send storeName and do not send industryId.
  await controller.create(actor, {
    displayName: "Legacy Business",
    legalName: null,
    storeName: "Legacy Store",
  });

  assert.throws(
    () =>
      controller.create(actor, {
        displayName: "Location Only Business",
        locationName: "Office",
      }),
    BadRequestException,
  );

  await controller.create(actor, {
    displayName: "  Business  ",
    legalName: "  Legal Name ",
    locationName: " Main Office ",
    industryId: " professional-services ",
  });

  assert.deepEqual(calls, [
    {
      displayName: "Legacy Business",
      legalName: null,
      locationName: "Legacy Store",
      storeName: "Legacy Store",
      industryId: "general-retail",
    },
    {
      displayName: "Business",
      legalName: "Legal Name",
      locationName: "Main Office",
      storeName: null,
      industryId: "professional-services",
    },
  ]);
});
