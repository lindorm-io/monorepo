import { VersionManager } from "./VersionManager";
import { Entity } from "../../../decorators/Entity";
import { Field } from "../../../decorators/Field";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField";
import { VersionField } from "../../../decorators/VersionField";
import { getEntityMetadata } from "../metadata/get-entity-metadata";

@Entity({ name: "VersionManagerVersioned" })
class VersionManagerVersioned {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @Field("string")
  name!: string;
}

@Entity({ name: "VersionManagerUnversioned" })
class VersionManagerUnversioned {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;
}

const makeVersionedManager = () =>
  new VersionManager(getEntityMetadata(VersionManagerVersioned));

const makeUnversionedManager = () =>
  new VersionManager(getEntityMetadata(VersionManagerUnversioned));

describe("VersionManager", () => {
  describe("constants", () => {
    test("INITIAL_VERSION should be 0", () => {
      expect(VersionManager.INITIAL_VERSION).toBe(0);
    });

    test("FIRST_PERSISTED_VERSION should be 1", () => {
      expect(VersionManager.FIRST_PERSISTED_VERSION).toBe(1);
    });
  });

  describe("isVersioned", () => {
    test("should return true when entity has Version field", () => {
      expect(makeVersionedManager().isVersioned()).toBe(true);
    });

    test("should return false when entity has no Version field", () => {
      expect(makeUnversionedManager().isVersioned()).toBe(false);
    });
  });

  describe("getVersion", () => {
    test("should return current version number", () => {
      const manager = makeVersionedManager();
      const entity = { id: "abc", version: 5, name: "test" } as VersionManagerVersioned;
      expect(manager.getVersion(entity)).toBe(5);
    });

    test("should return INITIAL_VERSION (0) when version is not a number", () => {
      const manager = makeVersionedManager();
      const entity = { id: "abc", version: "not-a-number" } as any;
      expect(manager.getVersion(entity)).toBe(0);
    });

    test("should return INITIAL_VERSION (0) for unversioned entity", () => {
      const manager = makeUnversionedManager();
      const entity = { id: "abc", name: "test" } as VersionManagerUnversioned;
      expect(manager.getVersion(entity)).toBe(0);
    });
  });

  describe("setVersion", () => {
    test("should set version on entity", () => {
      const manager = makeVersionedManager();
      const entity = { id: "abc", version: 1, name: "test" } as VersionManagerVersioned;
      manager.setVersion(entity, 10);
      expect(entity.version).toBe(10);
    });

    test("should not throw for unversioned entity", () => {
      const manager = makeUnversionedManager();
      const entity = { id: "abc", name: "test" } as VersionManagerUnversioned;
      expect(() => manager.setVersion(entity, 5)).not.toThrow();
    });

    test("should throw for negative version", () => {
      const manager = makeVersionedManager();
      const entity = { id: "abc", version: 1 } as any;
      expect(() => manager.setVersion(entity, -1)).toThrow(
        "Version must be non-negative integer",
      );
    });

    test("should throw for non-integer version", () => {
      const manager = makeVersionedManager();
      const entity = { id: "abc", version: 1 } as any;
      expect(() => manager.setVersion(entity, 1.5)).toThrow(
        "Version must be non-negative integer",
      );
    });

    test("should allow setting version to 0", () => {
      const manager = makeVersionedManager();
      const entity = { id: "abc", version: 5, name: "test" } as VersionManagerVersioned;
      manager.setVersion(entity, 0);
      expect(entity.version).toBe(0);
    });
  });

  describe("incrementVersion", () => {
    test("should increment version by 1", () => {
      const manager = makeVersionedManager();
      const entity = { id: "abc", version: 3, name: "test" } as VersionManagerVersioned;
      const newVersion = manager.incrementVersion(entity);
      expect(newVersion).toBe(4);
      expect(entity.version).toBe(4);
    });

    test("should increment from 0 to 1", () => {
      const manager = makeVersionedManager();
      const entity = { id: "abc", version: 0, name: "test" } as VersionManagerVersioned;
      manager.incrementVersion(entity);
      expect(entity.version).toBe(1);
    });
  });

  describe("prepareForInsert", () => {
    test("should set version to FIRST_PERSISTED_VERSION (1)", () => {
      const manager = makeVersionedManager();
      const entity = { id: "abc", version: 0, name: "test" } as VersionManagerVersioned;
      manager.prepareForInsert(entity);
      expect(entity.version).toBe(1);
    });
  });

  describe("prepareForUpdate", () => {
    test("should increment version", () => {
      const manager = makeVersionedManager();
      const entity = { id: "abc", version: 2, name: "test" } as VersionManagerVersioned;
      manager.prepareForUpdate(entity);
      expect(entity.version).toBe(3);
    });
  });
});
