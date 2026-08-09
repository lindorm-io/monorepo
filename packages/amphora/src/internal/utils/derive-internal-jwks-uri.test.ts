import { describe, expect, test } from "vitest";
import { deriveInternalJwksUri } from "./derive-internal-jwks-uri.js";

describe("deriveInternalJwksUri", () => {
  test("should derive the well-known path from a URL issuer", () => {
    expect(deriveInternalJwksUri("https://test.lindorm.io/")).toBe(
      "https://test.lindorm.io/.well-known/jwks.json",
    );
  });

  // The path is ABSOLUTE, so an issuer with a path segment still resolves to the
  // host root — unchanged by this rule, and pinned so it stays that way.
  test("should resolve against the host root, not the issuer path", () => {
    expect(deriveInternalJwksUri("https://test.lindorm.io/tenant/one")).toBe(
      "https://test.lindorm.io/.well-known/jwks.json",
    );
  });

  // A URN has no authority to reach. `new URL("/…", "urn:…")` throws outright, so
  // the answer has to be an explicit `null` rather than a derivation attempt.
  test("should derive nothing from a URN issuer", () => {
    expect(deriveInternalJwksUri("urn:lindorm:test")).toBeNull();
  });
});
