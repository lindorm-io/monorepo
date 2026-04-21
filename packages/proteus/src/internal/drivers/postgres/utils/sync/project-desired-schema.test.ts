import { describe, expect, it } from "vitest";
import {
  TestUser,
  TestChecked,
  TestIndexed,
} from "../../../../__fixtures__/test-entities.js";
import { makeField } from "../../../../__fixtures__/make-field.js";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata.js";
import type { EntityMetadata, MetaRelation } from "../../../../entity/types/metadata.js";
import { projectDesiredSchema } from "./project-desired-schema.js";

describe("projectDesiredSchema", () => {
  it("should project a simple entity", () => {
    const metadata = getEntityMetadata(TestUser);
    const result = projectDesiredSchema([metadata], {});

    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].name).toBe("TestUser");
    expect(result.tables[0].schema).toBe("public");
    expect(result).toMatchSnapshot();
  });

  it("should project columns with correct types", () => {
    const metadata = getEntityMetadata(TestUser);
    const result = projectDesiredSchema([metadata], {});
    const table = result.tables[0];

    const idCol = table.columns.find((c) => c.name === "id");
    expect(idCol?.pgType).toBe("UUID");
    expect(idCol?.defaultExpr).toBe("gen_random_uuid()");
    expect(idCol?.nullable).toBe(false);

    const emailCol = table.columns.find((c) => c.name === "email");
    expect(emailCol?.pgType).toBe("TEXT");
    expect(emailCol?.nullable).toBe(true);

    const ageCol = table.columns.find((c) => c.name === "age");
    expect(ageCol?.pgType).toBe("INTEGER");
    expect(ageCol?.defaultExpr).toBe("0");
  });

  it("should project primary key constraint", () => {
    const metadata = getEntityMetadata(TestUser);
    const result = projectDesiredSchema([metadata], {});
    const pk = result.tables[0].constraints.find((c) => c.type === "PRIMARY KEY");

    expect(pk).toBeDefined();
    expect(pk!.columns).toEqual(["id"]);
  });

  it("should project check constraints", () => {
    const metadata = getEntityMetadata(TestChecked);
    const result = projectDesiredSchema([metadata], {});
    const checks = result.tables[0].constraints.filter((c) => c.type === "CHECK");

    expect(checks).toHaveLength(2);
    expect(checks.find((c) => c.name === "age_positive")).toBeDefined();
  });

  it("should project unique constraints", () => {
    const metadata = getEntityMetadata(TestIndexed);
    const result = projectDesiredSchema([metadata], {});
    const uniques = result.tables[0].constraints.filter((c) => c.type === "UNIQUE");

    expect(uniques).toHaveLength(1);
    expect(uniques[0].name).toBe("unique_email");
    expect(uniques[0].columns).toEqual(["email"]);
  });

  it("should project indexes", () => {
    const metadata = getEntityMetadata(TestIndexed);
    const result = projectDesiredSchema([metadata], {});

    expect(result.tables[0].indexes.length).toBeGreaterThanOrEqual(1);
    const namedIdx = result.tables[0].indexes.find((i) => i.name === "idx_name");
    expect(namedIdx).toBeDefined();
    expect(namedIdx!.method).toBe("btree");
  });

  it("should project with namespace", () => {
    const metadata = getEntityMetadata(TestUser);
    const result = projectDesiredSchema([metadata], { namespace: "myapp" });

    expect(result.tables[0].schema).toBe("myapp");
    expect(result.schemas).toContain("myapp");
  });

  it("should project multiple entities", () => {
    const userMeta = getEntityMetadata(TestUser);
    const checkedMeta = getEntityMetadata(TestChecked);
    const result = projectDesiredSchema([userMeta, checkedMeta], {});

    expect(result.tables.length).toBeGreaterThanOrEqual(2);
    expect(result.tables.map((t) => t.name)).toContain("TestUser");
    expect(result.tables.map((t) => t.name)).toContain("TestChecked");
  });

  it("should throw when field.name exceeds 63 characters", () => {
    const longName = "a".repeat(64);
    const metadata = getEntityMetadata(TestUser);
    const patched: EntityMetadata = {
      ...metadata,
      fields: [makeField("id", { name: longName, type: "uuid" })],
    };

    expect(() => projectDesiredSchema([patched], {})).toThrow(`exceeds 63 characters`);
  });

  // ─── H2: FK column name collision with embedded column ──────────────────────

  it("should throw when an embedded field column name collides with a relation FK column", () => {
    // Use TestUser as target (it has proper metadata) but patch fields and relations.
    // The collision: embedded field "profile.userId" produces column "authorId" which
    // matches the FK column "authorId" from a ManyToOne relation to TestUser.
    const baseMeta = getEntityMetadata(TestUser);

    const metadata: EntityMetadata = {
      ...baseMeta,
      fields: [
        ...baseMeta.fields,
        makeField("profile.authorId", {
          name: "authorId",
          type: "uuid",
          embedded: { parentKey: "profile", constructor: () => Object as any },
        }),
      ],
      relations: [
        {
          key: "parent",
          foreignConstructor: () => TestUser,
          foreignKey: "posts",
          findKeys: null,
          joinKeys: { authorId: "id" },
          joinTable: null,
          orderBy: null,
          type: "ManyToOne",
          options: {
            cascade: {
              onInsert: false,
              onUpdate: false,
              onDestroy: false,
              onSoftDestroy: false,
            },
            deferrable: false,
            initiallyDeferred: false,
            loading: { single: "lazy", multiple: "lazy" },
            nullable: true,
            onDestroy: "set_null",
            onInsert: "ignore",
            onOrphan: "ignore",
            onSoftDestroy: "ignore",
            onUpdate: "cascade",
            strategy: null,
          },
        } as MetaRelation,
      ],
    };

    expect(() => projectDesiredSchema([metadata], {})).toThrow(
      /collides.*embedded field.*profile\.authorId.*authorId.*FK column/,
    );
  });

  it("should not throw when embedded column names and FK column names are distinct", () => {
    const baseMeta = getEntityMetadata(TestUser);

    const metadata: EntityMetadata = {
      ...baseMeta,
      fields: [
        ...baseMeta.fields,
        makeField("profile.name", {
          name: "profile_name",
          type: "string",
          embedded: { parentKey: "profile", constructor: () => Object as any },
        }),
      ],
      relations: [
        {
          key: "parent",
          foreignConstructor: () => TestUser,
          foreignKey: "posts",
          findKeys: null,
          joinKeys: { parent_id: "id" },
          joinTable: null,
          orderBy: null,
          type: "ManyToOne",
          options: {
            cascade: {
              onInsert: false,
              onUpdate: false,
              onDestroy: false,
              onSoftDestroy: false,
            },
            deferrable: false,
            initiallyDeferred: false,
            loading: { single: "lazy", multiple: "lazy" },
            nullable: true,
            onDestroy: "set_null",
            onInsert: "ignore",
            onOrphan: "ignore",
            onSoftDestroy: "ignore",
            onUpdate: "cascade",
            strategy: null,
          },
        } as MetaRelation,
      ],
    };

    expect(() => projectDesiredSchema([metadata], {})).not.toThrow();
  });

  it("should not produce duplicate enum entries when two fields share the same column name", () => {
    // Build metadata with two enum fields that would produce the same enumKey
    // (same tableName + same field.name). The enumSet guard must deduplicate them.
    const baseMeta = getEntityMetadata(TestUser);

    const sharedEnum = { Active: "active", Inactive: "inactive" };

    const metadata: EntityMetadata = {
      ...baseMeta,
      fields: [
        makeField("id", { type: "uuid" }),
        makeField("status", {
          name: "status",
          type: "enum",
          enum: sharedEnum,
          nullable: false,
        }),
        // Second field with the same column name "status" — would generate
        // the same enum key "public.enum_TestUser_status" if not guarded.
        makeField("statusCopy", {
          name: "status",
          type: "enum",
          enum: sharedEnum,
          nullable: false,
        }),
      ],
      relations: [],
    };

    const result = projectDesiredSchema([metadata], {});

    const statusEnums = result.enums.filter((e) => e.name === "enum_TestUser_status");
    expect(statusEnums).toHaveLength(1);
    expect(result.enums).toMatchSnapshot();
  });

  it("should force embedded child columns to nullable in Postgres DDL", () => {
    // Even when the child field has nullable: false, the DDL column must be nullable
    // because the parent embedded object can be null
    const baseMeta = getEntityMetadata(TestUser);

    const metadata: EntityMetadata = {
      ...baseMeta,
      fields: [
        makeField("id", { type: "uuid" }),
        makeField("address.street", {
          name: "address_street",
          type: "string",
          nullable: false, // non-nullable in embeddable
          embedded: { parentKey: "address", constructor: () => Object as any },
        }),
        makeField("address.zip", {
          name: "address_zip",
          type: "string",
          nullable: true, // nullable in embeddable
          embedded: { parentKey: "address", constructor: () => Object as any },
        }),
      ],
      relations: [],
    };

    const result = projectDesiredSchema([metadata], {});
    const table = result.tables[0];

    const streetCol = table.columns.find((c) => c.name === "address_street");
    const zipCol = table.columns.find((c) => c.name === "address_zip");

    // Both must be nullable in DDL — parent object can be null
    expect(streetCol?.nullable).toBe(true);
    expect(zipCol?.nullable).toBe(true);

    // Non-embedded fields should preserve their nullable state
    const idCol = table.columns.find((c) => c.name === "id");
    expect(idCol?.nullable).toBe(false);
  });
});
