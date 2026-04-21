import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Cache } from "./Cache.js";
import { Entity } from "./Entity.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "CacheDefault" })
@Cache()
class CacheDefault {
  @PrimaryKeyField()
  id!: string;
}

@Entity({ name: "CacheWithTtl" })
@Cache("5 Minutes")
class CacheWithTtl {
  @PrimaryKeyField()
  id!: string;
}

@Entity({ name: "NoCacheDecorator" })
class NoCacheDecorator {
  @PrimaryKeyField()
  id!: string;
}

describe("Cache", () => {
  test("should stage cache with ttlMs null when no options", () => {
    const metadata = getEntityMetadata(CacheDefault);
    expect(metadata.cache).toMatchSnapshot();
  });

  test("should stage cache with ttlMs 300000 for '5 Minutes'", () => {
    const metadata = getEntityMetadata(CacheWithTtl);
    expect(metadata.cache).toMatchSnapshot();
  });

  test("should return cache null when no @Cache decorator", () => {
    const metadata = getEntityMetadata(NoCacheDecorator);
    expect(metadata.cache).toBeNull();
  });
});
