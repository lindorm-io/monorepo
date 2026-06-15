import { describe, expect, test } from "vitest";
import { algAdvisory, algPermitted } from "./alg-permitted.js";

describe("algPermitted", () => {
  test("rejects none for every class", () => {
    expect(algPermitted("none", "asymmetric")).toMatchSnapshot();
    expect(algPermitted(undefined, "confidential")).toMatchSnapshot();
  });

  test("asymmetric permits an asymmetric alg and rejects HS*", () => {
    expect(algPermitted("ES512", "asymmetric")).toEqual([]);
    expect(algPermitted("HS256", "asymmetric")).toMatchSnapshot();
  });

  test("asymmetric-recommended permits HS* (never rejects) but still rejects none", () => {
    expect(algPermitted("ES512", "asymmetric-recommended")).toEqual([]);
    expect(algPermitted("HS256", "asymmetric-recommended")).toEqual([]); // permitted
    expect(algPermitted("none", "asymmetric-recommended")).toMatchSnapshot();
  });

  test("confidential permits both asymmetric and HS*", () => {
    expect(algPermitted("RS256", "confidential")).toEqual([]);
    expect(algPermitted("HS256", "confidential")).toEqual([]);
  });

  test("fapi permits only the allowlist", () => {
    expect(algPermitted("ES256", "fapi")).toEqual([]);
    expect(algPermitted("PS256", "fapi")).toEqual([]);
    expect(algPermitted("EdDSA", "fapi")).toEqual([]);
    expect(algPermitted("RS256", "fapi")).toMatchSnapshot();
  });
});

describe("algAdvisory", () => {
  test("warns on HS* only for asymmetric-recommended", () => {
    expect(algAdvisory("HS256", "asymmetric-recommended")).toContain("RECOMMENDED");
    expect(algAdvisory("ES512", "asymmetric-recommended")).toBeUndefined();
    expect(algAdvisory("HS256", "confidential")).toBeUndefined();
    expect(algAdvisory("HS256", "asymmetric")).toBeUndefined(); // hard-rejected elsewhere
  });
});
