import { describe, expect, test } from "vitest";
import { isHttpUrl } from "./is-http-url.js";

describe("isHttpUrl", () => {
  test.each([
    "https://tyr.lindorm.io/",
    "http://localhost:3000",
    "https://x", // host present
    "HTTPS://Tyr.Lindorm.IO", // scheme is case-insensitive
    "https://user:pass@tyr.lindorm.io/path?q=1#f",
    "http://[::1]:3000",
  ])("accepts an http(s) URL with a host: %s", (input) => {
    expect(isHttpUrl(input)).toBe(true);
  });

  test.each([
    "ftp://example.com", // a host, but not a scheme we can fetch over
    "ws://example.com",
    "file:///tmp/jwks.json",
    "mailto:a@b.com",
    "urn:lindorm:tyr:issuer", // a legal identifier, no location
    "urn:isbn:0451450523",
    "foo:bar",
    "tyr.lindorm.io", // no scheme
    "/.well-known/jwks.json", // relative — nothing to resolve against
    "",
    "   ",
    null,
    undefined,
    42,
    new URL("https://tyr.lindorm.io/"), // a URL instance is not a string
  ])("rejects a value no location can be derived from: %s", (input) => {
    expect(isHttpUrl(input)).toBe(false);
  });

  // `http`/`https` are WHATWG "special" schemes: the parse itself demands an
  // authority, which is what makes the guard's "with a host" half hold.
  test.each(["http://", "https://", "http:", "http://:8080", "http://@/x"])(
    "rejects an http URL carrying no host: %s",
    (input) => {
      expect(isHttpUrl(input)).toBe(false);
    },
  );
});
