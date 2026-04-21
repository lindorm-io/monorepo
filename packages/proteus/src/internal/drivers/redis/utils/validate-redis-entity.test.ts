// ─── Module Mocks ────────────────────────────────────────────────────────────
//
// Mock getEntityMetadata so that the new composite-PK check in validateRedisEntity
// can be satisfied without requiring actual @Entity-decorated classes.
// By default returns metadata with a single PK ("id") — a compatible foreign entity.

vi.mock("../../../entity/metadata/get-entity-metadata.js", () => ({
  getEntityMetadata: vi.fn(() => ({
    primaryKeys: ["id"],
    relations: [],
    entity: { name: "MockForeignEntity" },
  })),
}));

import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { NotSupportedError } from "../../../../errors/NotSupportedError.js";
import { RedisDriverError } from "../errors/RedisDriverError.js";
import { validateRedisEntity, isRedisCompatibleEntity } from "./validate-redis-entity.js";
import { describe, expect, test, vi, type Mock } from "vitest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const createBaseMetadata = (overrides?: Partial<EntityMetadata>): EntityMetadata => ({
  target: class TestEntity {} as any,
  appendOnly: false,
  cache: null,
  checks: [],
  defaultOrder: null,
  embeddedLists: [],
  entity: { decorator: "Entity", comment: null, name: "TestEntity", namespace: null },
  extras: [],
  fields: [
    {
      key: "id",
      decorator: "Field",
      arrayType: null,
      collation: null,
      comment: null,
      computed: null,
      embedded: null,
      encrypted: null,
      enum: null,
      default: null,
      hideOn: [],
      max: null,
      min: null,
      name: "id",
      nullable: false,
      order: null,
      precision: null,
      readonly: false,
      scale: null,
      schema: null,
      transform: null,
      type: "uuid",
    },
  ],
  filters: [],
  generated: [],
  hooks: [],
  inheritance: null,
  indexes: [],
  primaryKeys: ["id"],
  relationIds: [],
  relationCounts: [],
  relations: [],
  schemas: [],
  scopeKeys: [],
  uniques: [],
  versionKeys: [],
  ...overrides,
});

// ─── validateRedisEntity ──────────────────────────────────────────────────────

describe("validateRedisEntity", () => {
  const logger = createMockLogger();

  describe("happy path", () => {
    test("does not throw for a compatible entity", () => {
      const metadata = createBaseMetadata();
      expect(() => validateRedisEntity(metadata, logger)).not.toThrow();
    });

    test("does not throw for entity with relations and no expiry", () => {
      const metadata = createBaseMetadata({
        relations: [
          {
            key: "parent",
            foreignConstructor: () => class {} as any,
            foreignKey: "parentId",
            findKeys: null,
            joinKeys: null,
            joinTable: null,
            options: {
              deferrable: false,
              initiallyDeferred: false,
              loading: { single: "eager", multiple: "lazy" },
              nullable: true,
              onDestroy: "ignore",
              onInsert: "ignore",
              onOrphan: "ignore",
              onSoftDestroy: "ignore",
              onUpdate: "ignore",
              strategy: null,
            },
            orderBy: null,
            type: "ManyToOne",
          },
        ],
      });
      expect(() => validateRedisEntity(metadata, logger)).not.toThrow();
    });
  });

  describe("unsupported features", () => {
    test("throws NotSupportedError for @EmbeddedList", () => {
      const metadata = createBaseMetadata({
        embeddedLists: [
          {
            key: "items",
            tableName: "test_items",
            parentFkColumn: "testId",
            parentPkColumn: "id",
            elementType: "string",
            elementFields: null,
            elementConstructor: null,
            loading: { single: "eager", multiple: "lazy" },
          },
        ],
      });
      expect(() => validateRedisEntity(metadata, logger)).toThrow(NotSupportedError);
      expect(() => validateRedisEntity(metadata, logger)).toThrow("@EmbeddedList");
    });

    test("silently ignores @Index", () => {
      const metadata = createBaseMetadata({
        indexes: [
          {
            keys: [{ key: "name", direction: "asc", nulls: null }],
            include: null,
            name: null,
            unique: false,
            concurrent: false,
            sparse: false,
            where: null,
            using: null,
            with: null,
          },
        ],
      });
      expect(() => validateRedisEntity(metadata, logger)).not.toThrow();
    });

    test("throws NotSupportedError for @Unique", () => {
      const metadata = createBaseMetadata({
        uniques: [{ keys: ["email"], name: null }],
      });
      expect(() => validateRedisEntity(metadata, logger)).toThrow(NotSupportedError);
      expect(() => validateRedisEntity(metadata, logger)).toThrow("@Unique");
    });

    test("throws NotSupportedError for @Check", () => {
      const metadata = createBaseMetadata({
        checks: [{ expression: "age > 0", name: null }],
      });
      expect(() => validateRedisEntity(metadata, logger)).toThrow(NotSupportedError);
      expect(() => validateRedisEntity(metadata, logger)).toThrow("@Check");
    });

    test("throws NotSupportedError for @Computed", () => {
      const metadata = createBaseMetadata({
        fields: [
          {
            key: "fullName",
            decorator: "Field",
            arrayType: null,
            collation: null,
            comment: null,
            computed: "firstName || ' ' || lastName",
            embedded: null,
            encrypted: null,
            enum: null,
            default: null,
            hideOn: [],
            max: null,
            min: null,
            name: "fullName",
            nullable: false,
            order: null,
            precision: null,
            readonly: false,
            scale: null,
            schema: null,
            transform: null,
            type: "string",
          },
        ],
      });
      expect(() => validateRedisEntity(metadata, logger)).toThrow(NotSupportedError);
      expect(() => validateRedisEntity(metadata, logger)).toThrow("@Computed");
    });

    test("throws NotSupportedError for @VersionStartDate", () => {
      const metadata = createBaseMetadata({
        fields: [
          ...createBaseMetadata().fields,
          {
            key: "versionStartDate",
            decorator: "VersionStartDate",
            arrayType: null,
            collation: null,
            comment: null,
            computed: null,
            embedded: null,
            encrypted: null,
            enum: null,
            default: null,
            hideOn: [],
            max: null,
            min: null,
            name: "versionStartDate",
            nullable: false,
            order: null,
            precision: null,
            readonly: true,
            scale: null,
            schema: null,
            transform: null,
            type: "timestamp",
          },
        ],
      });
      expect(() => validateRedisEntity(metadata, logger)).toThrow(NotSupportedError);
      expect(() => validateRedisEntity(metadata, logger)).toThrow("@VersionKey family");
    });

    test("throws NotSupportedError for @VersionEndDate", () => {
      const metadata = createBaseMetadata({
        fields: [
          ...createBaseMetadata().fields,
          {
            key: "versionEndDate",
            decorator: "VersionEndDate",
            arrayType: null,
            collation: null,
            comment: null,
            computed: null,
            embedded: null,
            encrypted: null,
            enum: null,
            default: null,
            hideOn: [],
            max: null,
            min: null,
            name: "versionEndDate",
            nullable: true,
            order: null,
            precision: null,
            readonly: true,
            scale: null,
            schema: null,
            transform: null,
            type: "timestamp",
          },
        ],
      });
      expect(() => validateRedisEntity(metadata, logger)).toThrow(NotSupportedError);
      expect(() => validateRedisEntity(metadata, logger)).toThrow("@VersionKey family");
    });
  });

  describe("expiry conflict rules", () => {
    test("throws RedisDriverError for ExpiryDate + DeleteDate", () => {
      const metadata = createBaseMetadata({
        fields: [
          ...createBaseMetadata().fields,
          {
            key: "expiresAt",
            decorator: "ExpiryDate",
            arrayType: null,
            collation: null,
            comment: null,
            computed: null,
            embedded: null,
            encrypted: null,
            enum: null,
            default: null,
            hideOn: [],
            max: null,
            min: null,
            name: "expiresAt",
            nullable: true,
            order: null,
            precision: null,
            readonly: false,
            scale: null,
            schema: null,
            transform: null,
            type: "timestamp",
          },
          {
            key: "deletedAt",
            decorator: "DeleteDate",
            arrayType: null,
            collation: null,
            comment: null,
            computed: null,
            embedded: null,
            encrypted: null,
            enum: null,
            default: null,
            hideOn: [],
            max: null,
            min: null,
            name: "deletedAt",
            nullable: true,
            order: null,
            precision: null,
            readonly: false,
            scale: null,
            schema: null,
            transform: null,
            type: "timestamp",
          },
        ],
      });
      expect(() => validateRedisEntity(metadata, logger)).toThrow(RedisDriverError);
      expect(() => validateRedisEntity(metadata, logger)).toThrow(
        "expiry combined with soft-delete",
      );
    });

    test("throws RedisDriverError for ExpiryDate + ManyToMany owning side", () => {
      const metadata = createBaseMetadata({
        fields: [
          ...createBaseMetadata().fields,
          {
            key: "expiresAt",
            decorator: "ExpiryDate",
            arrayType: null,
            collation: null,
            comment: null,
            computed: null,
            embedded: null,
            encrypted: null,
            enum: null,
            default: null,
            hideOn: [],
            max: null,
            min: null,
            name: "expiresAt",
            nullable: true,
            order: null,
            precision: null,
            readonly: false,
            scale: null,
            schema: null,
            transform: null,
            type: "timestamp",
          },
        ],
        relations: [
          {
            key: "tags",
            foreignConstructor: () => class {} as any,
            foreignKey: "tagId",
            findKeys: null,
            joinKeys: { id: "entityId" },
            joinTable: "entity_tags",
            options: {
              deferrable: false,
              initiallyDeferred: false,
              loading: { single: "eager", multiple: "lazy" },
              nullable: false,
              onDestroy: "cascade",
              onInsert: "cascade",
              onOrphan: "delete",
              onSoftDestroy: "ignore",
              onUpdate: "cascade",
              strategy: null,
            },
            orderBy: null,
            type: "ManyToMany",
          },
        ],
      });
      expect(() => validateRedisEntity(metadata, logger)).toThrow(RedisDriverError);
      expect(() => validateRedisEntity(metadata, logger)).toThrow(
        "expiry on entities that own a ManyToMany",
      );
    });

    test("does not warn for ExpiryDate + ManyToOne relation", () => {
      const mockLogger = createMockLogger();
      const metadata = createBaseMetadata({
        fields: [
          ...createBaseMetadata().fields,
          {
            key: "expiresAt",
            decorator: "ExpiryDate",
            arrayType: null,
            collation: null,
            comment: null,
            computed: null,
            embedded: null,
            encrypted: null,
            enum: null,
            default: null,
            hideOn: [],
            max: null,
            min: null,
            name: "expiresAt",
            nullable: true,
            order: null,
            precision: null,
            readonly: false,
            scale: null,
            schema: null,
            transform: null,
            type: "timestamp",
          },
        ],
        relations: [
          {
            key: "parent",
            foreignConstructor: () => class {} as any,
            foreignKey: "parentId",
            findKeys: null,
            joinKeys: null,
            joinTable: null,
            options: {
              deferrable: false,
              initiallyDeferred: false,
              loading: { single: "eager", multiple: "lazy" },
              nullable: true,
              onDestroy: "ignore",
              onInsert: "ignore",
              onOrphan: "ignore",
              onSoftDestroy: "ignore",
              onUpdate: "ignore",
              strategy: null,
            },
            orderBy: null,
            type: "ManyToOne",
          },
        ],
      });

      expect(() => validateRedisEntity(metadata, mockLogger)).not.toThrow();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test("does not warn for ExpiryDate + ManyToMany inverse side (no joinKeys)", () => {
      const mockLogger = createMockLogger();
      const metadata = createBaseMetadata({
        fields: [
          ...createBaseMetadata().fields,
          {
            key: "expiresAt",
            decorator: "ExpiryDate",
            arrayType: null,
            collation: null,
            comment: null,
            computed: null,
            embedded: null,
            encrypted: null,
            enum: null,
            default: null,
            hideOn: [],
            max: null,
            min: null,
            name: "expiresAt",
            nullable: true,
            order: null,
            precision: null,
            readonly: false,
            scale: null,
            schema: null,
            transform: null,
            type: "timestamp",
          },
        ],
        relations: [
          {
            key: "tags",
            foreignConstructor: () => class {} as any,
            foreignKey: "tagId",
            findKeys: null,
            joinKeys: null,
            joinTable: "entity_tags",
            options: {
              deferrable: false,
              initiallyDeferred: false,
              loading: { single: "eager", multiple: "lazy" },
              nullable: false,
              onDestroy: "cascade",
              onInsert: "cascade",
              onOrphan: "delete",
              onSoftDestroy: "ignore",
              onUpdate: "cascade",
              strategy: null,
            },
            orderBy: null,
            type: "ManyToMany",
          },
        ],
      });

      // ManyToMany inverse side (joinKeys: null) does not throw and does not warn
      // (only OneToMany and inverse OneToOne trigger the orphan warning)
      expect(() => validateRedisEntity(metadata, mockLogger)).not.toThrow();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});

// ─── isRedisCompatibleEntity ──────────────────────────────────────────────────

describe("isRedisCompatibleEntity", () => {
  test("returns true for compatible entity", () => {
    const metadata = createBaseMetadata();
    expect(isRedisCompatibleEntity(metadata)).toBe(true);
  });

  test("returns false for @EmbeddedList", () => {
    const metadata = createBaseMetadata({
      embeddedLists: [
        {
          key: "items",
          tableName: "items",
          parentFkColumn: "testId",
          parentPkColumn: "id",
          elementType: "string",
          elementFields: null,
          elementConstructor: null,
          loading: { single: "eager", multiple: "lazy" },
        },
      ],
    });
    expect(isRedisCompatibleEntity(metadata)).toBe(false);
  });

  test("returns true for @Index (silently ignored)", () => {
    const metadata = createBaseMetadata({
      indexes: [
        {
          keys: [{ key: "name", direction: "asc", nulls: null }],
          include: null,
          name: null,
          unique: false,
          concurrent: false,
          sparse: false,
          where: null,
          using: null,
          with: null,
        },
      ],
    });
    expect(isRedisCompatibleEntity(metadata)).toBe(true);
  });

  test("returns false for @Unique", () => {
    const metadata = createBaseMetadata({
      uniques: [{ keys: ["email"], name: null }],
    });
    expect(isRedisCompatibleEntity(metadata)).toBe(false);
  });

  test("returns false for @Check", () => {
    const metadata = createBaseMetadata({
      checks: [{ expression: "age > 0", name: null }],
    });
    expect(isRedisCompatibleEntity(metadata)).toBe(false);
  });

  test("returns false for @Computed", () => {
    const metadata = createBaseMetadata({
      fields: [
        {
          key: "fullName",
          decorator: "Field",
          arrayType: null,
          collation: null,
          comment: null,
          computed: "firstName || lastName",
          embedded: null,
          encrypted: null,
          enum: null,
          default: null,
          hideOn: [],
          max: null,
          min: null,
          name: "fullName",
          nullable: false,
          order: null,
          precision: null,
          readonly: false,
          scale: null,
          schema: null,
          transform: null,
          type: "string",
        },
      ],
    });
    expect(isRedisCompatibleEntity(metadata)).toBe(false);
  });

  test("returns false for @VersionStartDate", () => {
    const metadata = createBaseMetadata({
      fields: [
        ...createBaseMetadata().fields,
        {
          key: "vsd",
          decorator: "VersionStartDate",
          arrayType: null,
          collation: null,
          comment: null,
          computed: null,
          embedded: null,
          encrypted: null,
          enum: null,
          default: null,
          hideOn: [],
          max: null,
          min: null,
          name: "vsd",
          nullable: false,
          order: null,
          precision: null,
          readonly: true,
          scale: null,
          schema: null,
          transform: null,
          type: "timestamp",
        },
      ],
    });
    expect(isRedisCompatibleEntity(metadata)).toBe(false);
  });

  test("returns false for ExpiryDate + DeleteDate", () => {
    const metadata = createBaseMetadata({
      fields: [
        ...createBaseMetadata().fields,
        {
          key: "expiresAt",
          decorator: "ExpiryDate",
          arrayType: null,
          collation: null,
          comment: null,
          computed: null,
          embedded: null,
          encrypted: null,
          enum: null,
          default: null,
          hideOn: [],
          max: null,
          min: null,
          name: "expiresAt",
          nullable: true,
          order: null,
          precision: null,
          readonly: false,
          scale: null,
          schema: null,
          transform: null,
          type: "timestamp",
        },
        {
          key: "deletedAt",
          decorator: "DeleteDate",
          arrayType: null,
          collation: null,
          comment: null,
          computed: null,
          embedded: null,
          encrypted: null,
          enum: null,
          default: null,
          hideOn: [],
          max: null,
          min: null,
          name: "deletedAt",
          nullable: true,
          order: null,
          precision: null,
          readonly: false,
          scale: null,
          schema: null,
          transform: null,
          type: "timestamp",
        },
      ],
    });
    expect(isRedisCompatibleEntity(metadata)).toBe(false);
  });

  test("returns false for ExpiryDate + ManyToMany owning side", () => {
    const metadata = createBaseMetadata({
      fields: [
        ...createBaseMetadata().fields,
        {
          key: "expiresAt",
          decorator: "ExpiryDate",
          arrayType: null,
          collation: null,
          comment: null,
          computed: null,
          embedded: null,
          encrypted: null,
          enum: null,
          default: null,
          hideOn: [],
          max: null,
          min: null,
          name: "expiresAt",
          nullable: true,
          order: null,
          precision: null,
          readonly: false,
          scale: null,
          schema: null,
          transform: null,
          type: "timestamp",
        },
      ],
      relations: [
        {
          key: "tags",
          foreignConstructor: () => class {} as any,
          foreignKey: "tagId",
          findKeys: null,
          joinKeys: { id: "entityId" },
          joinTable: "entity_tags",
          options: {
            deferrable: false,
            initiallyDeferred: false,
            loading: { single: "eager", multiple: "lazy" },
            nullable: false,
            onDestroy: "cascade",
            onInsert: "cascade",
            onOrphan: "delete",
            onSoftDestroy: "ignore",
            onUpdate: "cascade",
            strategy: null,
          },
          orderBy: null,
          type: "ManyToMany",
        },
      ],
    });
    expect(isRedisCompatibleEntity(metadata)).toBe(false);
  });

  test("returns true for ExpiryDate + ManyToMany inverse side (no joinKeys)", () => {
    const metadata = createBaseMetadata({
      fields: [
        ...createBaseMetadata().fields,
        {
          key: "expiresAt",
          decorator: "ExpiryDate",
          arrayType: null,
          collation: null,
          comment: null,
          computed: null,
          embedded: null,
          encrypted: null,
          enum: null,
          default: null,
          hideOn: [],
          max: null,
          min: null,
          name: "expiresAt",
          nullable: true,
          order: null,
          precision: null,
          readonly: false,
          scale: null,
          schema: null,
          transform: null,
          type: "timestamp",
        },
      ],
      relations: [
        {
          key: "tags",
          foreignConstructor: () => class {} as any,
          foreignKey: "tagId",
          findKeys: null,
          joinKeys: null,
          joinTable: "entity_tags",
          options: {
            deferrable: false,
            initiallyDeferred: false,
            loading: { single: "eager", multiple: "lazy" },
            nullable: false,
            onDestroy: "cascade",
            onInsert: "cascade",
            onOrphan: "delete",
            onSoftDestroy: "ignore",
            onUpdate: "cascade",
            strategy: null,
          },
          orderBy: null,
          type: "ManyToMany",
        },
      ],
    });
    expect(isRedisCompatibleEntity(metadata)).toBe(true);
  });
});
