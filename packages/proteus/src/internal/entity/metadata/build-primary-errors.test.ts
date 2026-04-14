/**
 * Tests for build-primary error guards:
 * - B7: nested @Embeddable within @Embeddable throws EntityMetadataError
 * - B11: duplicate collection table names throw EntityMetadataError
 * - B13: structured element types ("object", "json", "array") in @EmbeddedList throw EntityMetadataError
 * - C7: parentFkColumn uses column name (from @Field name option), not property key
 * - C8: validateFields is called on embeddable element fields in @EmbeddedList
 * - C9: @EmbeddedList key colliding with a @Field key throws EntityMetadataError
 */

import { getEntityMetadata } from "./get-entity-metadata";
import { Eager } from "../../../decorators/Eager";
import { Embeddable } from "../../../decorators/Embeddable";
import { Embedded } from "../../../decorators/Embedded";
import { EmbeddedList } from "../../../decorators/EmbeddedList";
import { Entity } from "../../../decorators/Entity";
import { Field } from "../../../decorators/Field";
import { Lazy } from "../../../decorators/Lazy";
import { PrimaryKey } from "../../../decorators/PrimaryKey";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField";

// ─── B7: Nested @Embeddable guard ────────────────────────────────────────────

describe("build-primary — nested @Embeddable guard (B7)", () => {
  test("should throw when an @Embeddable class contains nested @Embedded fields", () => {
    @Embeddable()
    class InnerAddress {
      @Field("string")
      street!: string;
    }

    // An embeddable that itself contains an @Embedded field — not supported
    @Embeddable()
    class OuterAddressWithNested {
      @Field("string")
      label!: string;

      @Embedded(() => InnerAddress)
      inner!: InnerAddress | null;
    }

    expect(() => {
      @Entity({ name: "B7EntityNestedEmbeddable" })
      class B7EntityNestedEmbeddable {
        @PrimaryKeyField()
        id!: string;

        @Embedded(() => OuterAddressWithNested)
        address!: OuterAddressWithNested | null;
      }

      getEntityMetadata(B7EntityNestedEmbeddable);
    }).toThrow(/Nested embeddables are not supported/);
  });

  test("error message should include the referencing field key and embeddable class name", () => {
    @Embeddable()
    class NestedInner {
      @Field("string")
      value!: string;
    }

    @Embeddable()
    class NestedOuter {
      @Field("string")
      name!: string;

      @Embedded(() => NestedInner)
      inner!: NestedInner | null;
    }

    let caughtError: Error | undefined;
    try {
      @Entity({ name: "B7ErrorMessageEntity" })
      class B7ErrorMessageEntity {
        @PrimaryKeyField()
        id!: string;

        @Embedded(() => NestedOuter)
        profile!: NestedOuter | null;
      }

      getEntityMetadata(B7ErrorMessageEntity);
    } catch (e) {
      caughtError = e as Error;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError!.message).toMatchSnapshot();
    // Must mention the offending property and the embeddable class
    expect(caughtError!.message).toMatch(/NestedOuter/);
  });

  test("should allow non-nested embeddables (flat @Embeddable is valid)", () => {
    @Embeddable()
    class FlatAddress {
      @Field("string")
      street!: string;

      @Field("string")
      city!: string;
    }

    expect(() => {
      @Entity({ name: "B7FlatEmbeddableEntity" })
      class B7FlatEmbeddableEntity {
        @PrimaryKeyField()
        id!: string;

        @Embedded(() => FlatAddress)
        address!: FlatAddress | null;
      }

      getEntityMetadata(B7FlatEmbeddableEntity);
    }).not.toThrow();
  });
});

// ─── B11: Duplicate collection table names ────────────────────────────────────

describe("build-primary — duplicate @EmbeddedList table name guard (B11)", () => {
  test("should throw when two @EmbeddedList fields resolve to the same auto-generated table name", () => {
    // Would require both fields to have the same snake_case table name — which means same key.
    // Instead test via explicit tableName conflict.
    expect(() => {
      @Entity({ name: "B11DuplicateTableEntity" })
      class B11DuplicateTableEntity {
        @PrimaryKeyField()
        id!: string;

        @EmbeddedList("string", { tableName: "shared_collection" })
        tags!: string[];

        @EmbeddedList("integer", { tableName: "shared_collection" })
        scores!: number[];
      }

      getEntityMetadata(B11DuplicateTableEntity);
    }).toThrow(/Duplicate collection table name/);
  });

  test("error message should include the duplicate table name", () => {
    let caughtError: Error | undefined;
    try {
      @Entity({ name: "B11ErrorMessageEntity" })
      class B11ErrorMessageEntity {
        @PrimaryKeyField()
        id!: string;

        @EmbeddedList("string", { tableName: "dup_table" })
        listA!: string[];

        @EmbeddedList("string", { tableName: "dup_table" })
        listB!: string[];
      }

      getEntityMetadata(B11ErrorMessageEntity);
    } catch (e) {
      caughtError = e as Error;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError!.message).toMatchSnapshot();
    expect(caughtError!.message).toContain("dup_table");
  });

  test("should not throw when two @EmbeddedList fields have different table names", () => {
    expect(() => {
      @Entity({ name: "B11UniqueTableEntity" })
      class B11UniqueTableEntity {
        @PrimaryKeyField()
        id!: string;

        @EmbeddedList("string", { tableName: "table_one" })
        tags!: string[];

        @EmbeddedList("integer", { tableName: "table_two" })
        scores!: number[];
      }

      getEntityMetadata(B11UniqueTableEntity);
    }).not.toThrow();
  });
});

// ─── B13: Reject structured element types ────────────────────────────────────

describe("build-primary — reject structured @EmbeddedList element types (B13)", () => {
  test("should throw for element type 'object'", () => {
    expect(() => {
      @Entity({ name: "B13ObjectTypeEntity" })
      class B13ObjectTypeEntity {
        @PrimaryKeyField()
        id!: string;

        @EmbeddedList("object" as any)
        data!: object[];
      }

      getEntityMetadata(B13ObjectTypeEntity);
    }).toThrow(/not supported/);
  });

  test("should throw for element type 'json'", () => {
    expect(() => {
      @Entity({ name: "B13JsonTypeEntity" })
      class B13JsonTypeEntity {
        @PrimaryKeyField()
        id!: string;

        @EmbeddedList("json" as any)
        payload!: object[];
      }

      getEntityMetadata(B13JsonTypeEntity);
    }).toThrow(/not supported/);
  });

  test("should throw for element type 'array'", () => {
    expect(() => {
      @Entity({ name: "B13ArrayTypeEntity" })
      class B13ArrayTypeEntity {
        @PrimaryKeyField()
        id!: string;

        @EmbeddedList("array" as any)
        nested!: any[][];
      }

      getEntityMetadata(B13ArrayTypeEntity);
    }).toThrow(/not supported/);
  });

  test("error message should include the element type and mention @Embeddable alternative", () => {
    let caughtError: Error | undefined;
    try {
      @Entity({ name: "B13ErrorMsgEntity" })
      class B13ErrorMsgEntity {
        @PrimaryKeyField()
        id!: string;

        @EmbeddedList("json" as any)
        configs!: object[];
      }

      getEntityMetadata(B13ErrorMsgEntity);
    } catch (e) {
      caughtError = e as Error;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError!.message).toMatchSnapshot();
    expect(caughtError!.message).toContain("json");
    expect(caughtError!.message).toMatch(/@Embeddable/);
  });

  test("should allow scalar element types (string, integer, uuid)", () => {
    expect(() => {
      @Entity({ name: "B13ValidScalarEntity" })
      class B13ValidScalarEntity {
        @PrimaryKeyField()
        id!: string;

        @EmbeddedList("string")
        tags!: string[];

        @EmbeddedList("integer", { tableName: "b13_valid_scores" })
        scores!: number[];

        @EmbeddedList("uuid", { tableName: "b13_valid_ids" })
        linkedIds!: string[];
      }

      getEntityMetadata(B13ValidScalarEntity);
    }).not.toThrow();
  });
});

// ─── C7: parentFkColumn uses column name not property key ─────────────────────

describe("build-primary — parentFkColumn uses column name not property key (C7)", () => {
  test("parentFkColumn uses the pk field column name when @Field has an explicit name override", () => {
    // The PK property key is "entityId" but column name is "id"
    // parentFkColumn should be "c7_custom_pk_entity_id" (snakeCase(entityName) + "_" + pkField.name)
    @Entity({ name: "C7CustomPkEntity" })
    class C7CustomPkEntity {
      @Field("uuid", { name: "id" })
      @PrimaryKey()
      entityId!: string;

      @EmbeddedList("string", { tableName: "c7_tags" })
      tags!: string[];
    }

    const meta = getEntityMetadata(C7CustomPkEntity);
    const el = meta.embeddedLists[0];

    // The primary key property key is "entityId", column name is "id"
    // parentFkColumn must use the column name "id", not the property key "entityId"
    expect(el.parentFkColumn).toMatchSnapshot();
    expect(el.parentFkColumn).toBe("c7_custom_pk_entity_id");
    expect(el.parentFkColumn).not.toContain("entityId");
  });

  test("parentFkColumn uses property key as fallback when field has no explicit name override", () => {
    @Entity({ name: "C7DefaultNameEntity" })
    class C7DefaultNameEntity {
      @PrimaryKeyField()
      id!: string;

      @EmbeddedList("string", { tableName: "c7_default_tags" })
      tags!: string[];
    }

    const meta = getEntityMetadata(C7DefaultNameEntity);
    const el = meta.embeddedLists[0];

    // PK property key is "id", column name is also "id" (no override)
    expect(el.parentFkColumn).toMatchSnapshot();
    expect(el.parentFkColumn).toBe("c7_default_name_entity_id");
  });

  test("parentFkColumn reflects column name override across different pk property key names", () => {
    // Verify that two entities with different pk property keys but same column name
    // produce the same suffix in parentFkColumn
    @Entity({ name: "C7AlphaEntity" })
    class C7AlphaEntity {
      @Field("uuid", { name: "record_id" })
      @PrimaryKey()
      pkProperty!: string;

      @EmbeddedList("string", { tableName: "c7_alpha_items" })
      items!: string[];
    }

    const meta = getEntityMetadata(C7AlphaEntity);
    const el = meta.embeddedLists[0];

    // parentFkColumn should use column name "record_id", not property key "pkProperty"
    expect(el.parentFkColumn).toMatchSnapshot();
    expect(el.parentFkColumn).toContain("record_id");
    expect(el.parentFkColumn).not.toContain("pkProperty");
    expect(el.parentFkColumn).not.toContain("pk_property");
  });

  test("parentPkColumn always stores the property key (not the column name)", () => {
    @Entity({ name: "C7ParentPkColumnEntity" })
    class C7ParentPkColumnEntity {
      @Field("uuid", { name: "col_name" })
      @PrimaryKey()
      propKey!: string;

      @EmbeddedList("string", { tableName: "c7_parent_pk_items" })
      items!: string[];
    }

    const meta = getEntityMetadata(C7ParentPkColumnEntity);
    const el = meta.embeddedLists[0];

    // parentPkColumn is used to read the value from the entity instance — must be the property key
    expect(el.parentPkColumn).toBe("propKey");
    expect(el.parentFkColumn).toContain("col_name");
  });
});

// ─── C8: validateFields called on embeddable element fields ───────────────────

describe("build-primary — validateFields called on embeddable element fields (C8)", () => {
  test("throws when embeddable element has duplicate field column names", () => {
    // validateFields throws on duplicate column names — this verifies it is invoked on embeddable fields
    @Embeddable()
    class C8BadEmbeddable {
      @Field("string", { name: "shared_col" })
      fieldA!: string;

      @Field("string", { name: "shared_col" })
      fieldB!: string;
    }

    expect(() => {
      @Entity({ name: "C8DuplicateEmbeddableColEntity" })
      class C8DuplicateEmbeddableColEntity {
        @PrimaryKeyField()
        id!: string;

        @EmbeddedList(() => C8BadEmbeddable, { tableName: "c8_items" })
        items!: C8BadEmbeddable[];
      }

      getEntityMetadata(C8DuplicateEmbeddableColEntity);
    }).toThrow(/Duplicate field column name/);
  });

  test("does not throw when embeddable element fields are valid", () => {
    @Embeddable()
    class C8GoodEmbeddable {
      @Field("string")
      fieldA!: string;

      @Field("integer")
      fieldB!: number;
    }

    expect(() => {
      @Entity({ name: "C8ValidEmbeddableEntity" })
      class C8ValidEmbeddableEntity {
        @PrimaryKeyField()
        id!: string;

        @EmbeddedList(() => C8GoodEmbeddable, { tableName: "c8_good_items" })
        items!: C8GoodEmbeddable[];
      }

      getEntityMetadata(C8ValidEmbeddableEntity);
    }).not.toThrow();
  });
});

// ─── C9: @EmbeddedList key collision with @Field key ─────────────────────────

describe("build-primary — @EmbeddedList / @Field key collision guard (C9)", () => {
  test("throws when an @EmbeddedList property key matches an @Field property key", () => {
    expect(() => {
      @Entity({ name: "C9CollisionEntity" })
      class C9CollisionEntity {
        @PrimaryKeyField()
        id!: string;

        @Field("string")
        tags!: string;

        @EmbeddedList("string", { tableName: "c9_tags_list" })
        // TypeScript won't allow two declarations with the same name in one class body,
        // so we test via metadata manipulation — rename the EmbeddedList key to collide
        // with the @Field key after decoration.
        extraTags!: string[];
      }

      // Patch Symbol.metadata to simulate the collision
      const meta = (C9CollisionEntity as any)[Symbol.metadata];
      if (meta && meta.embeddedLists) {
        meta.embeddedLists[meta.embeddedLists.length - 1].key = "tags";
      }

      getEntityMetadata(C9CollisionEntity);
    }).toThrow(/declared as both @Field and @EmbeddedList/);
  });

  test("error message includes the colliding property name", () => {
    let caughtError: Error | undefined;

    try {
      @Entity({ name: "C9ErrorMsgEntity" })
      class C9ErrorMsgEntity {
        @PrimaryKeyField()
        id!: string;

        @Field("string")
        items!: string;

        @EmbeddedList("string", { tableName: "c9_error_items" })
        extraItems!: string[];
      }

      const meta = (C9ErrorMsgEntity as any)[Symbol.metadata];
      if (meta && meta.embeddedLists) {
        meta.embeddedLists[meta.embeddedLists.length - 1].key = "items";
      }

      getEntityMetadata(C9ErrorMsgEntity);
    } catch (e) {
      caughtError = e as Error;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError!.message).toMatchSnapshot();
    expect(caughtError!.message).toContain("items");
  });

  test("does not throw when @EmbeddedList and @Field keys are distinct", () => {
    expect(() => {
      @Entity({ name: "C9NoCollisionEntity" })
      class C9NoCollisionEntity {
        @PrimaryKeyField()
        id!: string;

        @Field("string")
        label!: string;

        @EmbeddedList("string", { tableName: "c9_no_collision_items" })
        items!: string[];
      }

      getEntityMetadata(C9NoCollisionEntity);
    }).not.toThrow();
  });
});

// ─── Lazy @EmbeddedList field-initializer guard ──────────────────────────────

describe("build-primary — lazy @EmbeddedList field-initializer guard", () => {
  test("should throw when a lazy @EmbeddedList field carries a default-value initializer", () => {
    expect(() => {
      @Entity({ name: "LazyElInitDefault" })
      class LazyElInitDefault {
        @PrimaryKeyField()
        id!: string;

        @Field("string")
        name!: string;

        // Default scope: multiple=lazy — initializer below must be rejected.
        @EmbeddedList("string")
        tags: string[] = [];
      }

      getEntityMetadata(LazyElInitDefault);
    }).toThrow(
      /@EmbeddedList property "tags" on "LazyElInitDefault" carries a runtime field initializer but resolves to a lazy loading scope/,
    );
  });

  test("should throw when an explicit @Lazy() @EmbeddedList field carries an initializer", () => {
    expect(() => {
      @Entity({ name: "LazyElInitExplicit" })
      class LazyElInitExplicit {
        @PrimaryKeyField()
        id!: string;

        @Field("string")
        name!: string;

        @Lazy()
        @EmbeddedList("string")
        tags: string[] = [];
      }

      getEntityMetadata(LazyElInitExplicit);
    }).toThrow(/carries a runtime field initializer/);
  });

  test('should throw when @Lazy("single") @EmbeddedList field carries an initializer', () => {
    expect(() => {
      @Entity({ name: "LazyElInitSingleScope" })
      class LazyElInitSingleScope {
        @PrimaryKeyField()
        id!: string;

        @Field("string")
        name!: string;

        @Lazy("single")
        @EmbeddedList("string")
        tags: string[] = [];
      }

      getEntityMetadata(LazyElInitSingleScope);
    }).toThrow(/lazy loading scope/);
  });

  test("should NOT throw when an eager-only @EmbeddedList field carries an initializer", () => {
    expect(() => {
      @Entity({ name: "EagerElInitAllowed" })
      class EagerElInitAllowed {
        @PrimaryKeyField()
        id!: string;

        @Field("string")
        name!: string;

        // @Eager() on both scopes — no lazy loading, so initializer is fine.
        @Eager()
        @EmbeddedList("string")
        tags: string[] = [];
      }

      getEntityMetadata(EagerElInitAllowed);
    }).not.toThrow();
  });

  test("should NOT throw when a lazy @EmbeddedList field uses definite-assignment assertion", () => {
    expect(() => {
      @Entity({ name: "LazyElDefiniteAssignment" })
      class LazyElDefiniteAssignment {
        @PrimaryKeyField()
        id!: string;

        @Field("string")
        name!: string;

        @EmbeddedList("string")
        tags!: string[];
      }

      getEntityMetadata(LazyElDefiniteAssignment);
    }).not.toThrow();
  });
});
