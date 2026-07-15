import { describe, expect, test } from "vitest";
import { isUri } from "./is-uri.js";

describe("isUri", () => {
  test.each([
    "https://tyr.lindorm.io/",
    "http://localhost:3000",
    "https://x", // host present
    "urn:lindorm:tyr:issuer",
    "urn:isbn:0451450523",
  ])("accepts a real URL or a URN: %s", (input) => {
    expect(isUri(input)).toBe(true);
  });

  test.each([
    "", // empty
    "   ",
    "tyr.lindorm.io", // no scheme
    "foo:bar", // a scheme but no authority and not a URN
    "mailto:a@b.com", // scheme, no authority, not urn
    "https://", // no host
    null,
    undefined,
    42,
  ])("rejects a non-identifier: %s", (input) => {
    expect(isUri(input)).toBe(false);
  });
});
