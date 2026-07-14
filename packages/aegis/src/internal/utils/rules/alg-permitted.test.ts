import { describe, expect, test } from "vitest";
import { FAPI_SIG_ALGS } from "../../../constants/fapi.js";
import { algPermitted } from "./alg-permitted.js";

describe("algPermitted", () => {
  test("rejects none for every class", () => {
    expect(algPermitted("none", "asymmetric")).toMatchSnapshot();
    expect(algPermitted(undefined, "asymmetric")).toMatchSnapshot();
    expect(algPermitted("none", "symmetric")).toMatchSnapshot();
  });

  test("asymmetric permits an asymmetric alg and rejects HS*", () => {
    expect(algPermitted("ES512", "asymmetric")).toEqual([]);
    expect(algPermitted("EdDSA", "asymmetric")).toEqual([]);
    expect(algPermitted("HS256", "asymmetric")).toMatchSnapshot();
  });

  test("symmetric permits HS* and rejects an asymmetric alg", () => {
    expect(algPermitted("HS256", "symmetric")).toEqual([]);
    expect(algPermitted("ES512", "symmetric")).toMatchSnapshot();
  });

  test("throws on an unsupported alg class", () => {
    expect(() => algPermitted("ES256", "confidential" as never)).toThrow(
      /Unsupported alg class/,
    );
  });
});

describe("FAPI_SIG_ALGS", () => {
  // FAPI is deployment policy, not a key property: aegis publishes the list and
  // the deployment applies it as a selector predicate. It is deliberately NOT an
  // algClass, so `algPermitted` knows nothing about it.
  test("is the FAPI allowlist", () => {
    expect(FAPI_SIG_ALGS).toEqual(["PS256", "ES256", "EdDSA"]);
  });
});
