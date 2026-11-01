import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import test from "node:test";
import { TerminalController } from "../src/tenancy/terminal.controller";
import type { TerminalService } from "../src/tenancy/terminal.service";

test("terminal controller validates tenant, store, terminal UUIDs, and names", async () => {
  const calls: unknown[][] = [];
  const service = {
    register: async (...args: unknown[]) => {
      calls.push(args);
      return { terminalId: "terminal-1", credential: "secret-once" };
    },
    rotateCredential: async (...args: unknown[]) => {
      calls.push(args);
      return { terminalId: "terminal-1", credential: "rotated-once" };
    },
    suspend: async (...args: unknown[]) => {
      calls.push(args);
      return { terminalId: "terminal-1", status: "SUSPENDED" };
    },
    activate: async (...args: unknown[]) => {
      calls.push(args);
      return { terminalId: "terminal-1", status: "ACTIVE" };
    },
    revoke: async (...args: unknown[]) => {
      calls.push(args);
      return { terminalId: "terminal-1", status: "REVOKED" };
    },
  };
  const controller = new TerminalController(
    service as unknown as TerminalService,
  );
  const actor = { userId: "user-1", sessionId: "session-1" };
  const tenantId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
  const storeId = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
  const terminalId = "6ba7b812-9dad-11d1-80b4-00c04fd430c8";

  assert.throws(
    () => controller.register(actor, "bad", storeId, { name: "POS" }),
    BadRequestException,
  );
  assert.throws(
    () => controller.register(actor, tenantId, storeId, { name: "  " }),
    BadRequestException,
  );
  assert.throws(
    () => controller.rotateCredential(actor, tenantId, "bad"),
    BadRequestException,
  );

  await controller.register(actor, tenantId, storeId, { name: " Front POS " });
  await controller.rotateCredential(actor, tenantId, terminalId);
  await controller.suspend(actor, tenantId, terminalId);
  await controller.activate(actor, tenantId, terminalId);
  await controller.revoke(actor, tenantId, terminalId);

  assert.deepEqual(calls[0]?.slice(1), [tenantId, storeId, "Front POS"]);
  assert.equal(calls.length, 5);
});
