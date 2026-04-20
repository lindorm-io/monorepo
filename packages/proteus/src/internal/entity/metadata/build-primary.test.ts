/**
 * Tests for buildPrimaryMetadata — covering branches not already exercised by
 * build-primary-errors.test.ts, get-entity-metadata.test.ts, and decorator tests.
 *
 * Key branches targeted:
 * - @AbstractEntity guard (both solo and combined with @Entity)
 * - @Namespace merging into entity metadata
 * - @Cache decorator wired to MetaCache
 * - @DefaultOrder decorator wired to defaultOrder
 * - mergeFieldModifiers: duplicate decorator detection (throws for non-Hide)
 * - mergeFieldModifiers: @Hide is additive (does not throw for duplicates)
 * - mergeFieldModifiers: throws when modifier targets missing @Field
 * - mergeFieldModifiers: @Computed sets readonly = true
 * - flattenEmbeddedFields: duplicate column name after flattening throws
 * - flattenEmbeddedFields: non-@Embeddable class throws
 * - resolveEmbeddedLists: multiple primary keys throws
 * - embedded PK guard: embedded field as PK throws
 * - primaryCache: repeated call returns cached result (same object reference)
 */

import { buildPrimaryMetadata } from "./build-primary";
import { AbstractEntity } from "../../../decorators/AbstractEntity";
import { AppendOnly } from "../../../decorators/AppendOnly";
import { Cache } from "../../../decorators/Cache";
import { Computed } from "../../../decorators/Computed";
import { DefaultOrder } from "../../../decorators/DefaultOrder";
import { DeleteDateField } from "../../../decorators/DeleteDateField";
import { Embeddable } from "../../../decorators/Embeddable";
import { Embedded } from "../../../decorators/Embedded";
import { EmbeddedList } from "../../../decorators/EmbeddedList";
import { Entity } from "../../../decorators/Entity";
import { ExpiryDateField } from "../../../decorators/ExpiryDateField";
import { Field } from "../../../decorators/Field";
import { Hide } from "../../../decorators/Hide";
import { Namespace } from "../../../decorators/Namespace";
import { Nullable } from "../../../decorators/Nullable";
import { PrimaryKey } from "../../../decorators/PrimaryKey";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField";
import { VersionKeyField } from "../../../decorators/VersionKeyField";
import { EntityMetadataError } from "../errors/EntityMetadataError";
import { describe, expect, test } from "vitest";

// ─── @AbstractEntity guard ────────────────────────────────────────────────────

describe("buildPrimaryMetadata — @AbstractEntity guard", () => {
  test("throws when class has only @AbstractEntity (no @Entity)", () => {
    @AbstractEntity()
    class BpAbstractOnly {
      @PrimaryKeyField()
      id!: string;
    }

    expect(() => buildPrimaryMetadata(BpAbstractOnly)).toThrow(EntityMetadataError);
    expect(() => buildPrimaryMetadata(BpAbstractOnly)).toThrow(
      /Cannot build metadata for abstract entity/,
    );
  });

  test("throws when class has both @AbstractEntity and @Entity", () => {
    // Apply @Entity first (outer decorator executes last at class level)
    @AbstractEntity()
    @Entity({ name: "BpBothDecorators" })
    class BpBothDecorators {
      @PrimaryKeyField()
      id!: string;
    }

    expect(() => buildPrimaryMetadata(BpBothDecorators)).toThrow(EntityMetadataError);
    expect(() => buildPrimaryMetadata(BpBothDecorators)).toThrow(
      /@AbstractEntity and @Entity cannot be used on the same class/,
    );
  });

  test("subclass of @AbstractEntity with @Entity builds successfully", () => {
    @AbstractEntity()
    class BpAbstractBase {
      @PrimaryKeyField()
      id!: string;

      @Field("string")
      baseField!: string;
    }

    @Entity({ name: "BpConcreteSubclass" })
    class BpConcreteSubclass extends BpAbstractBase {
      @Field("integer")
      extra!: number;
    }

    expect(() => buildPrimaryMetadata(BpConcreteSubclass)).not.toThrow();
    const meta = buildPrimaryMetadata(BpConcreteSubclass);
    expect(meta.entity.name).toBe("BpConcreteSubclass");
    // Inherits fields from abstract base
    expect(meta.fields.some((f) => f.key === "baseField")).toBe(true);
    expect(meta.fields.some((f) => f.key === "extra")).toBe(true);
  });
});

// ─── @Namespace merging ────────────────────────────────────────────────────────

describe("buildPrimaryMetadata — @Namespace merging", () => {
  test("merges @Namespace value into entity.namespace", () => {
    @Namespace("my_schema")
    @Entity({ name: "BpWithNamespace" })
    class BpWithNamespace {
      @PrimaryKeyField()
      id!: string;
    }

    const meta = buildPrimaryMetadata(BpWithNamespace);
    expect(meta.entity.namespace).toBe("my_schema");
  });

  test("entity without @Namespace has null namespace by default", () => {
    @Entity({ name: "BpNoNamespace" })
    class BpNoNamespace {
      @PrimaryKeyField()
      id!: string;
    }

    const meta = buildPrimaryMetadata(BpNoNamespace);
    expect(meta.entity.namespace).toBeNull();
  });
});

// ─── @Cache ────────────────────────────────────────────────────────────────────

describe("buildPrimaryMetadata — @Cache decorator", () => {
  test("wires cache metadata with explicit TTL", () => {
    @Cache("5m")
    @Entity({ name: "BpWithCache" })
    class BpWithCache {
      @PrimaryKeyField()
      id!: string;
    }

    const meta = buildPrimaryMetadata(BpWithCache);
    expect(meta.cache).not.toBeNull();
    expect(meta.cache?.ttlMs).toMatchSnapshot();
    expect(meta.cache?.ttlMs).toBe(5 * 60 * 1000);
  });

  test("entity without @Cache has null cache", () => {
    @Entity({ name: "BpNoCache" })
    class BpNoCache {
      @PrimaryKeyField()
      id!: string;
    }

    const meta = buildPrimaryMetadata(BpNoCache);
    expect(meta.cache).toBeNull();
  });

  test("@Cache() with no TTL argument sets ttlMs to null", () => {
    @Cache()
    @Entity({ name: "BpCacheNoTtl" })
    class BpCacheNoTtl {
      @PrimaryKeyField()
      id!: string;
    }

    const meta = buildPrimaryMetadata(BpCacheNoTtl);
    expect(meta.cache).not.toBeNull();
    expect(meta.cache?.ttlMs).toBeNull();
  });
});

// ─── @DefaultOrder ─────────────────────────────────────────────────────────────

describe("buildPrimaryMetadata — @DefaultOrder decorator", () => {
  test("wires defaultOrder from decorator", () => {
    @DefaultOrder({ createdAt: "DESC" })
    @Entity({ name: "BpWithDefaultOrder" })
    class BpWithDefaultOrder {
      @PrimaryKeyField()
      id!: string;

      @Field("timestamp")
      createdAt!: Date;
    }

    const meta = buildPrimaryMetadata(BpWithDefaultOrder);
    expect(meta.defaultOrder).toMatchSnapshot();
    expect(meta.defaultOrder).toEqual({ createdAt: "DESC" });
  });

  test("entity without @DefaultOrder has null defaultOrder", () => {
    @Entity({ name: "BpNoDefaultOrder" })
    class BpNoDefaultOrder {
      @PrimaryKeyField()
      id!: string;
    }

    const meta = buildPrimaryMetadata(BpNoDefaultOrder);
    expect(meta.defaultOrder).toBeNull();
  });
});

// ─── mergeFieldModifiers — duplicate modifier detection ──────────────────────

describe("buildPrimaryMetadata — mergeFieldModifiers duplicate detection", () => {
  test("throws EntityMetadataError when same non-Hide modifier appears twice on a field", () => {
    // @Computed applied twice to the same field
    expect(() => {
      @Entity({ name: "BpDupComputedEntity" })
      class BpDupComputedEntity {
        @PrimaryKeyField()
        id!: string;

        @Computed("UPPER(name)")
        @Computed("LOWER(name)")
        @Field("string")
        name!: string;
      }

      buildPrimaryMetadata(BpDupComputedEntity);
    }).toThrow(/Duplicate @Computed/);
  });

  test("does not throw when @Hide is applied multiple times to same field (additive)", () => {
    expect(() => {
      @Entity({ name: "BpMultiHideEntity" })
      class BpMultiHideEntity {
        @PrimaryKeyField()
        id!: string;

        @Hide("single")
        @Hide("multiple")
        @Field("string")
        secret!: string;
      }

      const meta = buildPrimaryMetadata(BpMultiHideEntity);
      return meta;
    }).not.toThrow();
  });

  test("merges multiple @Hide scopes into hideOn array", () => {
    @Entity({ name: "BpHideMergeEntity" })
    class BpHideMergeEntity {
      @PrimaryKeyField()
      id!: string;

      @Hide("single")
      @Hide("multiple")
      @Field("string")
      secret!: string;
    }

    const meta = buildPrimaryMetadata(BpHideMergeEntity);
    const secretField = meta.fields.find((f) => f.key === "secret")!;
    expect(secretField.hideOn).toMatchSnapshot();
    expect(secretField.hideOn).toContain("single");
    expect(secretField.hideOn).toContain("multiple");
  });

  test("throws when modifier targets a property with no @Field decorator", () => {
    expect(() => {
      @Entity({ name: "BpModifierNoFieldEntity" })
      class BpModifierNoFieldEntity {
        @PrimaryKeyField()
        id!: string;

        // @Nullable applied to a property that has no @Field
        @Nullable()
        notAField!: string | null;
      }

      buildPrimaryMetadata(BpModifierNoFieldEntity);
    }).toThrow(/@Nullable on property "notAField" requires a @Field decorator/);
  });
});

// ─── mergeFieldModifiers — @Computed sets readonly ───────────────────────────

describe("buildPrimaryMetadata — @Computed auto-sets readonly", () => {
  test("@Computed field has readonly = true", () => {
    @Entity({ name: "BpComputedReadonlyEntity" })
    class BpComputedReadonlyEntity {
      @PrimaryKeyField()
      id!: string;

      @Computed("UPPER(name)")
      @Field("string")
      upperName!: string;
    }

    const meta = buildPrimaryMetadata(BpComputedReadonlyEntity);
    const field = meta.fields.find((f) => f.key === "upperName")!;
    expect(field.computed).toBe("UPPER(name)");
    expect(field.readonly).toBe(true);
  });
});

// ─── flattenEmbeddedFields: non-@Embeddable class ────────────────────────────

describe("buildPrimaryMetadata — flattenEmbeddedFields non-@Embeddable guard", () => {
  test("throws when @Embedded references a class not decorated with @Embeddable", () => {
    class PlainClass {
      street!: string;
    }

    expect(() => {
      @Entity({ name: "BpBadEmbedEntity" })
      class BpBadEmbedEntity {
        @PrimaryKeyField()
        id!: string;

        @Embedded(() => PlainClass)
        address!: PlainClass | null;
      }

      buildPrimaryMetadata(BpBadEmbedEntity);
    }).toThrow(/which is not decorated with @Embeddable\(\)/);
  });
});

// ─── flattenEmbeddedFields: duplicate column name after flattening ────────────

describe("buildPrimaryMetadata — flattenEmbeddedFields duplicate column name", () => {
  test("throws when embedded prefix creates a column name collision with an existing field", () => {
    @Embeddable()
    class BpCollideEmbeddable {
      @Field("string", { name: "name" })
      value!: string;
    }

    // The parent entity already has a field with column name "addr_name" AND the
    // embedded prefix "addr_" + column "name" = "addr_name" -> collision
    expect(() => {
      @Entity({ name: "BpDuplicateColumnEntity" })
      class BpDuplicateColumnEntity {
        @PrimaryKeyField()
        id!: string;

        // Direct field whose column name will collide with embedded field's final name
        @Field("string", { name: "addr_name" })
        addrName!: string;

        @Embedded(() => BpCollideEmbeddable, { prefix: "addr_" })
        address!: BpCollideEmbeddable | null;
      }

      buildPrimaryMetadata(BpDuplicateColumnEntity);
    }).toThrow(/Duplicate column name/);
  });
});

// ─── resolveEmbeddedLists: multiple primary keys ─────────────────────────────

describe("buildPrimaryMetadata — @EmbeddedList requires single PK", () => {
  test("throws when entity has composite primary key and uses @EmbeddedList", () => {
    expect(() => {
      @Entity({ name: "BpCompositePkEmbeddedList" })
      class BpCompositePkEmbeddedList {
        @PrimaryKey()
        @Field("uuid")
        id!: string;

        @VersionKeyField()
        versionId!: string;

        @EmbeddedList("string", { tableName: "bp_composite_tags" })
        tags!: string[];
      }

      buildPrimaryMetadata(BpCompositePkEmbeddedList);
    }).toThrow(/@EmbeddedList requires a single primary key/);
  });
});

// ─── Embedded PK guard ────────────────────────────────────────────────────────

describe("buildPrimaryMetadata — embedded field cannot be primary key", () => {
  test("throws when an embedded field key is used as a primary key", () => {
    @Embeddable()
    class BpPkEmbeddable {
      @Field("uuid")
      embId!: string;
    }

    expect(() => {
      @Entity({ name: "BpEmbeddedPkEntity" })
      class BpEmbeddedPkEntity {
        @PrimaryKeyField()
        id!: string;

        @Embedded(() => BpPkEmbeddable)
        pk!: BpPkEmbeddable | null;
      }

      // Manually inject a primary key that points to an embedded field key
      const meta = (BpEmbeddedPkEntity as any)[Symbol.metadata];
      if (meta && Array.isArray(meta.primaryKeys)) {
        meta.primaryKeys.push({ key: "pk.embId" });
      } else if (meta) {
        meta.primaryKeys = [{ key: "id" }, { key: "pk.embId" }];
      }

      buildPrimaryMetadata(BpEmbeddedPkEntity);
    }).toThrow(/Embedded field.*cannot be a primary key/);
  });
});

// ─── Primary cache ────────────────────────────────────────────────────────────

describe("buildPrimaryMetadata — primaryCache", () => {
  test("returns cached result on repeated calls (same object reference)", () => {
    @Entity({ name: "BpCachedEntity" })
    class BpCachedEntity {
      @PrimaryKeyField()
      id!: string;

      @Field("string")
      name!: string;
    }

    const first = buildPrimaryMetadata(BpCachedEntity);
    const second = buildPrimaryMetadata(BpCachedEntity);

    expect(first).toBe(second);
  });
});

// ─── Full metadata snapshot ───────────────────────────────────────────────────

describe("buildPrimaryMetadata — full metadata snapshot", () => {
  test("snapshot of complete metadata for a standard entity", () => {
    @Entity({ name: "BpSnapshotEntity" })
    class BpSnapshotEntity {
      @PrimaryKeyField()
      id!: string;

      @Field("string")
      name!: string;

      @Nullable()
      @Field("integer")
      age!: number | null;
    }

    const meta = buildPrimaryMetadata(BpSnapshotEntity);
    // Snapshot only stable fields — exclude target (circular ref)
    expect({
      entity: meta.entity,
      primaryKeys: meta.primaryKeys,
      fields: meta.fields,
      cache: meta.cache,
      defaultOrder: meta.defaultOrder,
    }).toMatchSnapshot();
  });
});

// ─── @AppendOnly contradictory decorator validation ──────────────────────────

describe("buildPrimaryMetadata — @AppendOnly contradictory decorators", () => {
  test("throws EntityMetadataError when @AppendOnly + @DeleteDateField", () => {
    expect(() => {
      @AppendOnly()
      @Entity({ name: "BpAppendOnlyDeleteDate" })
      class BpAppendOnlyDeleteDate {
        @PrimaryKeyField()
        id!: string;

        @DeleteDateField()
        deletedAt!: Date | null;
      }

      buildPrimaryMetadata(BpAppendOnlyDeleteDate);
    }).toThrow(EntityMetadataError);
  });

  test("error message for @AppendOnly + @DeleteDateField matches snapshot", () => {
    expect(() => {
      @AppendOnly()
      @Entity({ name: "BpAppendOnlyDeleteDate2" })
      class BpAppendOnlyDeleteDate2 {
        @PrimaryKeyField()
        id!: string;

        @DeleteDateField()
        deletedAt!: Date | null;
      }

      buildPrimaryMetadata(BpAppendOnlyDeleteDate2);
    }).toThrowErrorMatchingSnapshot();
  });

  test("throws EntityMetadataError when @AppendOnly + @ExpiryDateField", () => {
    expect(() => {
      @AppendOnly()
      @Entity({ name: "BpAppendOnlyExpiryDate" })
      class BpAppendOnlyExpiryDate {
        @PrimaryKeyField()
        id!: string;

        @ExpiryDateField()
        expiresAt!: Date | null;
      }

      buildPrimaryMetadata(BpAppendOnlyExpiryDate);
    }).toThrow(EntityMetadataError);
  });

  test("error message for @AppendOnly + @ExpiryDateField matches snapshot", () => {
    expect(() => {
      @AppendOnly()
      @Entity({ name: "BpAppendOnlyExpiryDate2" })
      class BpAppendOnlyExpiryDate2 {
        @PrimaryKeyField()
        id!: string;

        @ExpiryDateField()
        expiresAt!: Date | null;
      }

      buildPrimaryMetadata(BpAppendOnlyExpiryDate2);
    }).toThrowErrorMatchingSnapshot();
  });

  test("@AppendOnly without @DeleteDateField or @ExpiryDateField builds successfully", () => {
    @AppendOnly()
    @Entity({ name: "BpAppendOnlyClean" })
    class BpAppendOnlyClean {
      @PrimaryKeyField()
      id!: string;

      @Field("string")
      data!: string;
    }

    const meta = buildPrimaryMetadata(BpAppendOnlyClean);
    expect(meta.appendOnly).toBe(true);
    expect(meta.entity.name).toBe("BpAppendOnlyClean");
  });
});
