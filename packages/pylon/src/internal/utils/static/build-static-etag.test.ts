import { buildStaticEtag } from "./build-static-etag.js";
import { describe, expect, test } from "vitest";

describe("buildStaticEtag", () => {
  // 100 = 0x64, 1_700_000_000_000 = 0x18bcfe56800.
  const size = 100;
  const mtimeMs = 1_700_000_000_000;

  test("builds a weak validator from size and mtime hex", () => {
    expect(buildStaticEtag(size, mtimeMs, null)).toBe('W/"64-18bcfe56800"');
  });

  test("folds a -br suffix into brotli variants", () => {
    expect(buildStaticEtag(size, mtimeMs, "br")).toBe('W/"64-18bcfe56800-br"');
  });

  test("folds a -gz suffix into gzip variants", () => {
    expect(buildStaticEtag(size, mtimeMs, "gzip")).toBe('W/"64-18bcfe56800-gz"');
  });

  test("floors a fractional mtimeMs before encoding", () => {
    expect(buildStaticEtag(size, mtimeMs + 0.9, null)).toBe('W/"64-18bcfe56800"');
  });

  test("identity and encoded variants never share an etag", () => {
    const identity = buildStaticEtag(size, mtimeMs, null);
    const brotli = buildStaticEtag(size, mtimeMs, "br");
    const gzip = buildStaticEtag(size, mtimeMs, "gzip");

    expect(new Set([identity, brotli, gzip]).size).toBe(3);
  });
});
