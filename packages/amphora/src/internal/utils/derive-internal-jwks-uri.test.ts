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

  test("should derive from an http issuer", () => {
    expect(deriveInternalJwksUri("http://localhost:3000")).toBe(
      "http://localhost:3000/.well-known/jwks.json",
    );
  });

  // A URN has no authority to reach. `new URL("/…", "urn:…")` throws outright, so
  // the answer has to be an explicit `null` rather than a derivation attempt.
  test("should derive nothing from a URN issuer", () => {
    expect(deriveInternalJwksUri("urn:lindorm:test")).toBeNull();
  });

  // The case a URN-only rule missed. `ftp://example.com` IS a URI — it is not a
  // URN, and it has an authority — so resolving a path against it succeeds and
  // produces `ftp://example.com/.well-known/jwks.json`: a syntactically valid
  // address nothing can fetch. Deriving a LOCATION needs a scheme we can request
  // over, not merely a legal identifier.
  test.each(["ftp://example.com", "ws://example.com"])(
    "should derive nothing from a non-http URI issuer: %s",
    (issuer) => {
      expect(deriveInternalJwksUri(issuer)).toBeNull();
    },
  );
});
