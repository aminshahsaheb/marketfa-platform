import assert from "node:assert/strict";
import test from "node:test";
import { IS_PUBLIC_KEY } from "../src/auth/auth.constants";
import { IndustryCatalogController } from "../src/tenancy/industry-catalog.controller";
import type { IndustryCatalogService } from "../src/tenancy/industry-catalog.service";

test("industry catalogue endpoint is public and returns service data", async () => {
  const expected = [
    {
      id: "general-retail",
      profileVersion: 1,
      labelKey: "industry.general_retail",
      group: "retail",
      regulated: false,
      capabilities: ["customers", "sales"],
    },
  ];
  const controller = new IndustryCatalogController({
    list: async () => expected,
  } as unknown as IndustryCatalogService);

  assert.equal(
    Reflect.getMetadata(IS_PUBLIC_KEY, IndustryCatalogController),
    true,
  );
  assert.deepEqual(await controller.list(), expected);
});
