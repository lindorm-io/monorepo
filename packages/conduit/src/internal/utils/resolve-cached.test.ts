import { resolveCached } from "./resolve-cached.js";
import { describe, expect, test } from "vitest";

describe("resolveCached", () => {
  test("returns null for headers with no cache markers", () => {
    expect(resolveCached({})).toBeNull();
    expect(resolveCached({ "content-type": "application/json" })).toBeNull();
  });

  test("returns 'client' for conduit cache middleware HIT", () => {
    expect(resolveCached({ "x-conduit-cache-middleware": "HIT" })).toBe("client");
  });

  test("returns null for conduit cache middleware MISS", () => {
    expect(resolveCached({ "x-conduit-cache-middleware": "MISS" })).toBeNull();
  });

  test("prefers 'client' over an upstream marker on the same response", () => {
    expect(
      resolveCached({
        "x-conduit-cache-middleware": "HIT",
        "x-pylon-cache": "HIT",
      }),
    ).toBe("client");
  });

  test("returns 'upstream' for pylon useCache HIT", () => {
    expect(resolveCached({ "x-pylon-cache": "HIT" })).toBe("upstream");
  });

  test("returns null for pylon useCache MISS", () => {
    expect(resolveCached({ "x-pylon-cache": "MISS" })).toBeNull();
  });

  test.each(["HIT", "Hit from cloudfront", "MISS, HIT"])(
    "returns 'upstream' for x-cache containing a hit: %s",
    (value) => {
      expect(resolveCached({ "x-cache": value })).toBe("upstream");
    },
  );

  test("returns null for x-cache MISS", () => {
    expect(resolveCached({ "x-cache": "MISS" })).toBeNull();
  });

  test("returns 'upstream' for cloudflare cf-cache-status HIT", () => {
    expect(resolveCached({ "cf-cache-status": "HIT" })).toBe("upstream");
    expect(resolveCached({ "cf-cache-status": "EXPIRED" })).toBeNull();
  });

  test("returns 'upstream' for nginx x-cache-status HIT", () => {
    expect(resolveCached({ "x-cache-status": "HIT" })).toBe("upstream");
  });

  test("returns 'upstream' for a positive Age header", () => {
    expect(resolveCached({ age: 42 })).toBe("upstream");
    expect(resolveCached({ age: "42" })).toBe("upstream");
  });

  test("returns null for a zero or non-numeric Age header", () => {
    expect(resolveCached({ age: 0 })).toBeNull();
    expect(resolveCached({ age: "not-a-number" })).toBeNull();
  });

  test("matches header names and hit values case-insensitively", () => {
    expect(resolveCached({ "X-Conduit-Cache-Middleware": "hit" })).toBe("client");
    expect(resolveCached({ "X-Pylon-Cache": "Hit" })).toBe("upstream");
  });
});
