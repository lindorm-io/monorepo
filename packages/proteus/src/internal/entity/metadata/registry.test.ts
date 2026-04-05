import {
  findEntityByName,
  findEntityByTarget,
  getCachedMetadata,
  registerEntity,
  setCachedMetadata,
} from "./registry";
import type { EntityMetadata } from "../types/metadata";

const makeMinimalMetadata = (): EntityMetadata =>
  ({
    target: class RegistryTestEntity {},
    appendOnly: false,
    cache: null,
    checks: [],
    defaultOrder: null,
    embeddedLists: [],
    entity: {
      decorator: "Entity",
      cache: null,
      comment: null,
      database: null,
      name: "RegistryTestEntity",
      namespace: null,
    },
    extras: [],
    fields: [],
    filters: [],
    generated: [],
    hooks: [],
    inheritance: null,
    indexes: [],
    primaryKeys: [],
    relations: [],
    relationCounts: [],
    relationIds: [],
    schemas: [],
    scopeKeys: [],
    uniques: [],
    versionKeys: [],
  }) as EntityMetadata;

describe("registry", () => {
  describe("registerEntity / findEntityByName / findEntityByTarget", () => {
    test("should register entity and find by name", () => {
      class RegistryFindByName {}
      registerEntity("RegistryFindByName", RegistryFindByName);
      expect(findEntityByName("RegistryFindByName")).toBe(RegistryFindByName);
    });

    test("should register entity and find by target", () => {
      class RegistryFindByTarget {}
      registerEntity("RegistryFindByTarget", RegistryFindByTarget);
      expect(findEntityByTarget(RegistryFindByTarget)).toBe("RegistryFindByTarget");
    });

    test("should return undefined for unknown name", () => {
      expect(findEntityByName("NonExistentEntity")).toBeUndefined();
    });

    test("should return undefined for unregistered target", () => {
      class UnregisteredClass {}
      expect(findEntityByTarget(UnregisteredClass)).toBeUndefined();
    });

    test("should allow re-registering different class with same name (HMR support)", () => {
      class DuplicateNameClassA {}
      class DuplicateNameClassB {}
      registerEntity("DuplicateNameTest", DuplicateNameClassA);
      registerEntity("DuplicateNameTest", DuplicateNameClassB);
      expect(findEntityByName("DuplicateNameTest")).toBe(DuplicateNameClassB);
      expect(findEntityByTarget(DuplicateNameClassA)).toBeUndefined();
      expect(findEntityByTarget(DuplicateNameClassB)).toBe("DuplicateNameTest");
    });

    test("should allow re-registering same class with same name", () => {
      class IdempotentClass {}
      registerEntity("IdempotentTest", IdempotentClass);
      expect(() => registerEntity("IdempotentTest", IdempotentClass)).not.toThrow();
    });
  });

  describe("getCachedMetadata / setCachedMetadata", () => {
    test("should return undefined before caching", () => {
      class NotYetCached {}
      expect(getCachedMetadata(NotYetCached)).toBeUndefined();
    });

    test("should return cached metadata after setting", () => {
      class ToBeCached {}
      const metadata = makeMinimalMetadata();
      setCachedMetadata(ToBeCached, metadata);
      expect(getCachedMetadata(ToBeCached)).toBe(metadata);
    });
  });
});
