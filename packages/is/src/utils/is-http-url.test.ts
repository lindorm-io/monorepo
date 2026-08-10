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
    "https://tyr.lindorm.io:8443/path/to/thing?q=1&r=2#frag",
    "https://xn--exmple-cua.com/path", // punycoded IDN host
    "https://exämple.com/path", // unicode IDN host — the parse normalises it
    "https://tyr.lindorm.io/%20p?q=a%2Bb#f%20g", // percent-encoded
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

  // The WHATWG parser DELETES tab/LF/CR from anywhere in the input and trims
  // leading/trailing C0 controls and space, so a guard that validates the PARSE
  // says "valid" about a string that differs from the one the caller then stores
  // or string-compares. These guards gate issuer matching and redirect-uri
  // allowlists, so the validated value and the used value must be the same value.
  test.each([
    ["a newline inside the host", "https://tyr.lindorm\n.io"],
    ["a tab inside the host", "https://tyr.lindorm\t.io"],
    ["a tab before the path", "https://tyr.lindorm.io\t/x"],
    ["a carriage return in the path", "https://tyr.lindorm.io/\rx"],
    ["surrounding space", "  https://tyr.lindorm.io  "],
    ["a leading newline", "\nhttps://tyr.lindorm.io"],
    ["a trailing tab", "https://tyr.lindorm.io\t"],
    ["a C0 control mid-string", "https://tyr.lindorm.io/x\u0007y"],
    ["a DEL mid-string", "https://tyr.lindorm.io/x\u007fy"],
    ["a space in the path", "https://tyr.lindorm.io/a b"],
  ])("rejects an http URL carrying %s", (_, input) => {
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
