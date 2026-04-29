import type { MetaCache } from "../../entity/types/metadata.js";
import { resolveCacheTtl } from "./resolve-cache-ttl.js";
import { describe, expect, test } from "vitest";

describe("resolveCacheTtl", () => {
  const decoratorCache: MetaCache = { ttlMs: 60000 };
  const sourceDefault = 120000;

  test("should disable when cache option is false regardless of decorator and source", () => {
    const result = resolveCacheTtl({
      findCacheOption: false,
      metaCache: decoratorCache,
      sourceTtlMs: sourceDefault,
    });
    expect(result).toMatchSnapshot();
  });

  test("should use decorator TTL when cache option is true", () => {
    const result = resolveCacheTtl({
      findCacheOption: true,
      metaCache: decoratorCache,
      sourceTtlMs: sourceDefault,
    });
    expect(result).toMatchSnapshot();
  });

  test("should use source default TTL when cache option is true and no decorator", () => {
    const result = resolveCacheTtl({
      findCacheOption: true,
      metaCache: null,
      sourceTtlMs: sourceDefault,
    });
    expect(result).toMatchSnapshot();
  });

  test("should disable when cache option is true but no TTL anywhere", () => {
    const result = resolveCacheTtl({
      findCacheOption: true,
      metaCache: null,
      sourceTtlMs: undefined,
    });
    expect(result).toMatchSnapshot();
  });

  test("should use explicit per-query TTL over decorator TTL", () => {
    const result = resolveCacheTtl({
      findCacheOption: { ttl: "30 Seconds" },
      metaCache: decoratorCache,
      sourceTtlMs: sourceDefault,
    });
    expect(result).toMatchSnapshot();
  });

  test("should use explicit per-query TTL over source default", () => {
    const result = resolveCacheTtl({
      findCacheOption: { ttl: "30 Seconds" },
      metaCache: null,
      sourceTtlMs: sourceDefault,
    });
    expect(result).toMatchSnapshot();
  });

  test("should use decorator TTL when no cache option is provided", () => {
    const result = resolveCacheTtl({
      findCacheOption: undefined,
      metaCache: decoratorCache,
      sourceTtlMs: undefined,
    });
    expect(result).toMatchSnapshot();
  });

  test("should use source default TTL when no cache option and no decorator", () => {
    const result = resolveCacheTtl({
      findCacheOption: undefined,
      metaCache: null,
      sourceTtlMs: sourceDefault,
    });
    expect(result).toMatchSnapshot();
  });

  test("should disable when no cache option and no decorator and no source default", () => {
    const result = resolveCacheTtl({
      findCacheOption: undefined,
      metaCache: null,
      sourceTtlMs: undefined,
    });
    expect(result).toMatchSnapshot();
  });

  test("should use decorator TTL when metaCache has null ttlMs", () => {
    const result = resolveCacheTtl({
      findCacheOption: true,
      metaCache: { ttlMs: null },
      sourceTtlMs: sourceDefault,
    });
    expect(result).toMatchSnapshot();
  });

  test("should handle cache object with no ttl property", () => {
    const result = resolveCacheTtl({
      findCacheOption: {},
      metaCache: decoratorCache,
      sourceTtlMs: sourceDefault,
    });
    expect(result).toMatchSnapshot();
  });
});
