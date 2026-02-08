import { EntityKitError } from "../errors";
import { Column, Entity, PrimaryKeyColumn, VersionColumn } from "../decorators";
import { VersionManager } from "./VersionManager";
import { globalEntityMetadata } from "../utils";

describe("VersionManager", () => {
  @Entity()
  class VersionedEntity {
    @PrimaryKeyColumn()
    id!: string;

    @Column("string")
    name!: string;

    @VersionColumn()
    version!: number;
  }

  @Entity()
  class NonVersionedEntity {
    @PrimaryKeyColumn()
    id!: string;

    @Column("string")
    name!: string;
  }

  describe("constructor", () => {
    it("should initialize with versioned entity metadata", () => {
      const metadata = globalEntityMetadata.get(VersionedEntity);
      const versionManager = new VersionManager(metadata);

      expect(versionManager).toBeInstanceOf(VersionManager);
      expect(versionManager.isVersioned()).toBe(true);
    });

    it("should initialize with non-versioned entity metadata", () => {
      const metadata = globalEntityMetadata.get(NonVersionedEntity);
      const versionManager = new VersionManager(metadata);

      expect(versionManager).toBeInstanceOf(VersionManager);
      expect(versionManager.isVersioned()).toBe(false);
    });
  });

  describe("constants", () => {
    it("should define INITIAL_VERSION as 0", () => {
      expect(VersionManager.INITIAL_VERSION).toBe(0);
    });

    it("should define FIRST_PERSISTED_VERSION as 1", () => {
      expect(VersionManager.FIRST_PERSISTED_VERSION).toBe(1);
    });
  });

  describe("isVersioned", () => {
    it("should return true for versioned entity", () => {
      const metadata = globalEntityMetadata.get(VersionedEntity);
      const versionManager = new VersionManager(metadata);

      expect(versionManager.isVersioned()).toBe(true);
    });

    it("should return false for non-versioned entity", () => {
      const metadata = globalEntityMetadata.get(NonVersionedEntity);
      const versionManager = new VersionManager(metadata);

      expect(versionManager.isVersioned()).toBe(false);
    });
  });

  describe("getVersion", () => {
    it("should return version from versioned entity", () => {
      const metadata = globalEntityMetadata.get(VersionedEntity);
      const versionManager = new VersionManager(metadata);
      const entity = new VersionedEntity();
      entity.version = 5;

      expect(versionManager.getVersion(entity)).toBe(5);
    });

    it("should return INITIAL_VERSION if version not set", () => {
      const metadata = globalEntityMetadata.get(VersionedEntity);
      const versionManager = new VersionManager(metadata);
      const entity = new VersionedEntity();

      expect(versionManager.getVersion(entity)).toBe(VersionManager.INITIAL_VERSION);
    });

    it("should return INITIAL_VERSION for non-versioned entity", () => {
      const metadata = globalEntityMetadata.get(NonVersionedEntity);
      const versionManager = new VersionManager(metadata);
      const entity = new NonVersionedEntity();

      expect(versionManager.getVersion(entity)).toBe(VersionManager.INITIAL_VERSION);
    });
  });

  describe("setVersion", () => {
    it("should set version on versioned entity", () => {
      const metadata = globalEntityMetadata.get(VersionedEntity);
      const versionManager = new VersionManager(metadata);
      const entity = new VersionedEntity();

      versionManager.setVersion(entity, 3);

      expect(entity.version).toBe(3);
    });

    it("should do nothing for non-versioned entity", () => {
      const metadata = globalEntityMetadata.get(NonVersionedEntity);
      const versionManager = new VersionManager(metadata);
      const entity = new NonVersionedEntity();

      versionManager.setVersion(entity, 3);

      expect((entity as any).version).toBeUndefined();
    });

    it("should throw error for negative version", () => {
      const metadata = globalEntityMetadata.get(VersionedEntity);
      const versionManager = new VersionManager(metadata);
      const entity = new VersionedEntity();

      expect(() => versionManager.setVersion(entity, -1)).toThrow(EntityKitError);
      expect(() => versionManager.setVersion(entity, -1)).toThrow(
        "Invalid version number: -1. Version must be non-negative integer.",
      );
    });

    it("should throw error for non-integer version", () => {
      const metadata = globalEntityMetadata.get(VersionedEntity);
      const versionManager = new VersionManager(metadata);
      const entity = new VersionedEntity();

      expect(() => versionManager.setVersion(entity, 1.5)).toThrow(EntityKitError);
      expect(() => versionManager.setVersion(entity, 1.5)).toThrow(
        "Invalid version number: 1.5. Version must be non-negative integer.",
      );
    });

    it("should accept zero as valid version", () => {
      const metadata = globalEntityMetadata.get(VersionedEntity);
      const versionManager = new VersionManager(metadata);
      const entity = new VersionedEntity();

      expect(() => versionManager.setVersion(entity, 0)).not.toThrow();
      expect(entity.version).toBe(0);
    });
  });

  describe("incrementVersion", () => {
    it("should increment version on versioned entity", () => {
      const metadata = globalEntityMetadata.get(VersionedEntity);
      const versionManager = new VersionManager(metadata);
      const entity = new VersionedEntity();
      entity.version = 5;

      const newVersion = versionManager.incrementVersion(entity);

      expect(newVersion).toBe(6);
      expect(entity.version).toBe(6);
    });

    it("should increment from INITIAL_VERSION if not set", () => {
      const metadata = globalEntityMetadata.get(VersionedEntity);
      const versionManager = new VersionManager(metadata);
      const entity = new VersionedEntity();

      const newVersion = versionManager.incrementVersion(entity);

      expect(newVersion).toBe(1);
      expect(entity.version).toBe(1);
    });

    it("should handle non-versioned entity gracefully", () => {
      const metadata = globalEntityMetadata.get(NonVersionedEntity);
      const versionManager = new VersionManager(metadata);
      const entity = new NonVersionedEntity();

      const newVersion = versionManager.incrementVersion(entity);

      expect(newVersion).toBe(1);
      expect((entity as any).version).toBeUndefined();
    });
  });

  describe("prepareForInsert", () => {
    it("should set version to FIRST_PERSISTED_VERSION", () => {
      const metadata = globalEntityMetadata.get(VersionedEntity);
      const versionManager = new VersionManager(metadata);
      const entity = new VersionedEntity();

      versionManager.prepareForInsert(entity);

      expect(entity.version).toBe(VersionManager.FIRST_PERSISTED_VERSION);
      expect(entity.version).toBe(1);
    });

    it("should do nothing for non-versioned entity", () => {
      const metadata = globalEntityMetadata.get(NonVersionedEntity);
      const versionManager = new VersionManager(metadata);
      const entity = new NonVersionedEntity();

      versionManager.prepareForInsert(entity);

      expect((entity as any).version).toBeUndefined();
    });

    it("should override existing version", () => {
      const metadata = globalEntityMetadata.get(VersionedEntity);
      const versionManager = new VersionManager(metadata);
      const entity = new VersionedEntity();
      entity.version = 10;

      versionManager.prepareForInsert(entity);

      expect(entity.version).toBe(1);
    });
  });

  describe("prepareForUpdate", () => {
    it("should increment version on versioned entity", () => {
      const metadata = globalEntityMetadata.get(VersionedEntity);
      const versionManager = new VersionManager(metadata);
      const entity = new VersionedEntity();
      entity.version = 3;

      versionManager.prepareForUpdate(entity);

      expect(entity.version).toBe(4);
    });

    it("should increment from INITIAL_VERSION if not set", () => {
      const metadata = globalEntityMetadata.get(VersionedEntity);
      const versionManager = new VersionManager(metadata);
      const entity = new VersionedEntity();

      versionManager.prepareForUpdate(entity);

      expect(entity.version).toBe(1);
    });

    it("should do nothing for non-versioned entity", () => {
      const metadata = globalEntityMetadata.get(NonVersionedEntity);
      const versionManager = new VersionManager(metadata);
      const entity = new NonVersionedEntity();

      versionManager.prepareForUpdate(entity);

      expect((entity as any).version).toBeUndefined();
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete entity lifecycle", () => {
      const metadata = globalEntityMetadata.get(VersionedEntity);
      const versionManager = new VersionManager(metadata);
      const entity = new VersionedEntity();

      // New entity starts at 0
      expect(versionManager.getVersion(entity)).toBe(0);

      // Prepare for insert sets to 1
      versionManager.prepareForInsert(entity);
      expect(entity.version).toBe(1);

      // Prepare for update increments
      versionManager.prepareForUpdate(entity);
      expect(entity.version).toBe(2);

      // Another update increments again
      versionManager.prepareForUpdate(entity);
      expect(entity.version).toBe(3);
    });

    it("should handle clone scenario", () => {
      const metadata = globalEntityMetadata.get(VersionedEntity);
      const versionManager = new VersionManager(metadata);

      // Original entity at version 10
      const original = new VersionedEntity();
      original.version = 10;

      // Clone should reset to INITIAL_VERSION (handled by defaultCloneEntity)
      const clone = new VersionedEntity();
      clone.version = 0;

      // Then prepare for insert sets to 1
      versionManager.prepareForInsert(clone);
      expect(clone.version).toBe(1);

      // Original unchanged
      expect(original.version).toBe(10);
    });
  });
});
