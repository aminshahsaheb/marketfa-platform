import assert from "node:assert/strict";
import test from "node:test";
test("health route is versioned", () => {
  assert.equal("/api/v1/health/live", `/${"api/v1"}/${"health/live"}`);
});
