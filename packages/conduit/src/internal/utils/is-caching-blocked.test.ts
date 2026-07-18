import { describe, expect, test } from "vitest";
import { isCachingBlocked } from "./is-caching-blocked.js";

describe("isCachingBlocked", () => {
  test.each([
    // Bare directives block.
    ["no-store", true],
    ["no-cache", true],
    ["No-Cache", true], // case-insensitive
    ["  no-cache  ", true], // surrounding whitespace
    ["max-age=0, no-cache", true], // alongside other directives
    ["public, max-age=3600, no-store", true],
    // Field-scoped argument form does NOT block — only the named header is
    // uncacheable, the body is still cacheable (RFC 7234 §5.2.2.2).
    ['no-cache="set-cookie"', false],
    ['no-cache="set-cookie, x-custom"', false], // quoted field-list w/ comma
    ['private, no-cache="set-cookie"', false],
    // Cacheable / unrelated directives.
    ["max-age=3600", false],
    ["public", false],
    ["private", false],
    ["no-transform", false],
    ["", false],
  ])("Cache-Control %j → blocked=%s", (cacheControl, expected) => {
    expect(isCachingBlocked(cacheControl)).toBe(expected);
  });
});
