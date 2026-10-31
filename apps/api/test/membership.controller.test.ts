import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import test from "node:test";
import { MembershipController } from "../src/tenancy/membership.controller";
import type { MembershipService } from "../src/tenancy/membership.service";

test("membership controller validates UUIDs and blocks OWNER role assignment", () => {
  const service = {
    changeRole: async () => ({ membershipId: "membership", role: "MANAGER" }),
    suspend: async () => ({ membershipId: "membership", status: "SUSPENDED" }),
    remove: async () => ({ membershipId: "membership", status: "REMOVED" }),
  };
  const controller = new MembershipController(
    service as unknown as MembershipService,
  );
  const actor = { userId: "user-1", sessionId: "session-1" };
  const tenantId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
  const membershipId = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

  assert.throws(
    () =>
      controller.changeRole(actor, "not-a-uuid", membershipId, {
        role: "MANAGER",
      }),
    BadRequestException,
  );
  assert.throws(
    () =>
      controller.changeRole(actor, tenantId, membershipId, {
        role: "OWNER",
      }),
    BadRequestException,
  );
  assert.throws(
    () => controller.changeRole(actor, tenantId, membershipId, {}),
    BadRequestException,
  );
});
