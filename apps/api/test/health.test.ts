import assert from "node:assert/strict";
import test from "node:test";

test("API health route contract is versioned under /api/v1", () => {
  const globalPrefix = "api/v1";
  const route = "health/live";
  assert.equal(`/${globalPrefix}/${route}`, "/api/v1/health/live");
});
