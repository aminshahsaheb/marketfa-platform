import assert from "node:assert/strict";
import test from "node:test";
import { IndustryCatalogService } from "../src/tenancy/industry-catalog.service";
import type { DatabaseService } from "../src/database/database.service";

test("industry catalogue groups server capabilities by versioned profile", async () => {
  let readOnly = false;
  let queryText = "";
  const database = {
    withPublicReader: async (
      operation: (client: unknown) => Promise<unknown>,
    ) => {
      readOnly = true;
      const client = {
        query: async (query: string) => {
          queryText = query;
          return {
            rows: [
              {
                industry_key: "professional-services",
                profile_version: 1,
                display_name_key: "industry.professional_services",
                group_key: "services",
                is_regulated: false,
                capability_key: "customers",
              },
              {
                industry_key: "professional-services",
                profile_version: 1,
                display_name_key: "industry.professional_services",
                group_key: "services",
                is_regulated: false,
                capability_key: "projects",
              },
              {
                industry_key: "pharmacy",
                profile_version: 1,
                display_name_key: "industry.pharmacy",
                group_key: "regulated-retail",
                is_regulated: true,
                capability_key: null,
              },
              {
                industry_key: "custom",
                profile_version: 1,
                display_name_key: "industry.custom",
                group_key: "custom",
                is_regulated: false,
                capability_key: null,
              },
            ],
          };
        },
      };
      return operation(client);
    },
  };

  const service = new IndustryCatalogService(
    database as unknown as DatabaseService,
  );
  const profiles = await service.list();

  assert.equal(readOnly, true);
  assert.match(queryText, /capability\.status = 'ACTIVE'/);
  assert.match(queryText, /capability\.capability_key/);
  assert.doesNotMatch(queryText, /SELECT[\s\S]*defaults\.capability_key/);
  assert.deepEqual(profiles, [
    {
      id: "professional-services",
      profileVersion: 1,
      labelKey: "industry.professional_services",
      group: "services",
      regulated: false,
      capabilities: ["customers", "projects"],
    },
    {
      id: "pharmacy",
      profileVersion: 1,
      labelKey: "industry.pharmacy",
      group: "regulated-retail",
      regulated: true,
      capabilities: [],
    },
    {
      id: "custom",
      profileVersion: 1,
      labelKey: "industry.custom",
      group: "custom",
      regulated: false,
      capabilities: [],
    },
  ]);
});
