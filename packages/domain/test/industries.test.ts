import assert from "node:assert/strict";
import test from "node:test";
import {
  getIndustryProfile,
  hasIndustryCapability,
  INDUSTRY_CAPABILITIES,
  INDUSTRY_PROFILES,
} from "../src/industries.js";

test("industry profile identifiers are unique", () => {
  const ids = INDUSTRY_PROFILES.map((profile) => profile.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every profile uses only registered capabilities", () => {
  for (const profile of INDUSTRY_PROFILES) {
    for (const capability of profile.capabilities) {
      assert.ok(INDUSTRY_CAPABILITIES.includes(capability));
    }
  }
});

test("service businesses do not inherit retail inventory by default", () => {
  const services = getIndustryProfile("professional-services");
  assert.ok(services);
  assert.equal(hasIndustryCapability(services, "inventory"), false);
  assert.equal(hasIndustryCapability(services, "point_of_sale"), false);
});

test("retail profiles include catalog, inventory and point of sale", () => {
  for (const id of ["general-retail", "grocery", "apparel", "electronics"]) {
    const profile = getIndustryProfile(id);
    assert.ok(profile);
    assert.equal(hasIndustryCapability(profile, "catalog"), true);
    assert.equal(hasIndustryCapability(profile, "inventory"), true);
    assert.equal(hasIndustryCapability(profile, "point_of_sale"), true);
  }
});

test("custom business profile starts with shared capabilities only", () => {
  const profile = getIndustryProfile("custom");
  assert.ok(profile);
  assert.deepEqual(profile.capabilities, [
    "customers",
    "sales",
    "payments",
    "expenses",
    "finance",
    "reports",
  ]);
});

test("unknown industry is not silently mapped to a profile", () => {
  assert.equal(getIndustryProfile("unknown-profession"), undefined);
});
