import { describe, expect, test } from "vitest";
import { isUrn } from "./is-urn.js";

describe("isUrn", () => {
  test.each([
    "urn:lindorm:tyr:issuer",
    "urn:isbn:0451450523",
    "URN:Lindorm:x", // scheme + NID case-insensitive
    "urn:a:b",
  ])("accepts %s", (input) => {
    expect(isUrn(input)).toBe(true);
  });

  test.each([
    "urn:lindorm:", // empty NSS
    "urn:lindorm", // no NSS at all
    "urn::x", // empty NID
    "https://tyr.lindorm.io/",
    "foo:bar",
    "",
    "   ",
    null,
    undefined,
    42,
  ])("rejects %s", (input) => {
    expect(isUrn(input)).toBe(false);
  });
});
