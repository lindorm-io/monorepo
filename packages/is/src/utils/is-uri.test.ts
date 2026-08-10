import { describe, expect, test } from "vitest";
import { isUri } from "./is-uri.js";

describe("isUri", () => {
  test.each([
    "https://tyr.lindorm.io/",
    "http://localhost:3000",
    "https://x", // host present
    "urn:lindorm:tyr:issuer",
    "urn:isbn:0451450523",
    "https://tyr.lindorm.io:8443/path/to/thing?q=1&r=2#frag",
    "https://xn--exmple-cua.com/path", // punycoded IDN host
    "https://exämple.com/path", // unicode IDN host — the parse normalises it
    "https://tyr.lindorm.io/%20p?q=a%2Bb#f%20g", // percent-encoded
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

  // An issuer is validated here and then STORED and string-compared. The WHATWG
  // parser deletes tab/LF/CR from anywhere and trims leading/trailing C0 controls
  // and space, so validating the parse would bless a string that is not the string
  // the caller keeps. Reject those code points instead, on both branches — a URN
  // reaches `new URL` in a consumer just as a URL does.
  test.each([
    ["a newline inside the host", "https://tyr.lindorm\n.io"],
    ["a tab before the path", "https://tyr.lindorm.io\t/x"],
    ["a carriage return in the path", "https://tyr.lindorm.io/\rx"],
    ["surrounding space", "  https://tyr.lindorm.io  "],
    ["a C0 control mid-string", "https://tyr.lindorm.io/x\u0007y"],
    ["a DEL mid-string", "https://tyr.lindorm.io/x\u007fy"],
    ["a newline inside a URN", "urn:lindorm:tyr:\nissuer"],
    ["a space inside a URN", "urn:lindorm:tyr issuer"],
    ["trailing space after a URN", "urn:isbn:0451450523  "],
    ["surrounding space around a URN", "  urn:isbn:0451450523  "],
  ])("rejects an identifier carrying %s", (_, input) => {
    expect(isUri(input)).toBe(false);
  });
});
