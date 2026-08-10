import { describe, expect, test } from "vitest";
import { isUrn } from "./is-urn.js";

describe("isUrn", () => {
  test.each([
    "urn:lindorm:tyr:issuer",
    "urn:isbn:0451450523",
    "URN:Lindorm:x", // scheme + NID case-insensitive
    "urn:a:b",
    "urn:ietf:rfc:2648",
    "urn:example:a123,z456/bar?q=1#frag",
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

  // RFC 8141 builds the NSS from pchar — whitespace and control characters must be
  // percent-encoded, never literal. It matters beyond pedantry because `isUri`
  // answers through this guard: a URN reaching `new URL` in a consumer would have
  // its tab/LF/CR deleted, so a blessed value would not be the value that was
  // blessed.
  test.each([
    ["a newline in the NSS", "urn:lindorm:tyr:\nissuer"],
    ["a carriage return in the NSS", "urn:lindorm:tyr:\rissuer"],
    ["a tab in the NSS", "urn:lindorm:tyr:\tissuer"],
    ["a space in the NSS", "urn:lindorm:tyr issuer"],
    ["a trailing tab", "urn:lindorm:tyr:issuer\t"],
    ["trailing space", "urn:lindorm:tyr:issuer  "],
    ["a C0 control in the NSS", "urn:lindorm:tyr:iss\u0007uer"],
    ["a DEL in the NSS", "urn:lindorm:tyr:iss\u007fuer"],
  ])("rejects a URN carrying %s", (_, input) => {
    expect(isUrn(input)).toBe(false);
  });
});
