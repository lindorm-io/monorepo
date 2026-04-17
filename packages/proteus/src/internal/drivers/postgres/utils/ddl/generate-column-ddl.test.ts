import { makeField } from "../../../../__fixtures__/make-field";
import type { EntityMetadata, MetaField } from "../../../../entity/types/metadata";
import { Default } from "../../../../../decorators/Default";
import { Entity } from "../../../../../decorators/Entity";
import { Field } from "../../../../../decorators/Field";
import { Generated } from "../../../../../decorators/Generated";
import { ManyToOne } from "../../../../../decorators/ManyToOne";
import { Nullable } from "../../../../../decorators/Nullable";
import { OneToMany } from "../../../../../decorators/OneToMany";
import { PrimaryKey } from "../../../../../decorators/PrimaryKey";
import { PrimaryKeyField } from "../../../../../decorators/PrimaryKeyField";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata";
import { applyNamingStrategy } from "../../../../utils/naming/apply-naming-strategy";
import { generateColumnDDL } from "./generate-column-ddl";

// ---------------------------------------------------------------------------
// Test entities — must be at module scope for stage-3 decorator execution.
// Both sides of each relation must be declared.
// ---------------------------------------------------------------------------

@Entity({ name: "ColParent" })
class ColParent {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @OneToMany(() => ColFkChild, "parent")
  childItems!: ColFkChild[];

  @OneToMany(() => ColFkChildExplicit, "parent")
  explicitItems!: ColFkChildExplicit[];
}

/** UUID primary key (gen_random_uuid) */
@Entity({ name: "ColUuidGenerated" })
class ColUuidGenerated {
  @PrimaryKey()
  @Field("uuid")
  @Generated("uuid")
  id!: string;

  @Field("string")
  title!: string;
}

/** Integer primary key (IDENTITY) */
@Entity({ name: "ColIntIdentity" })
class ColIntIdentity {
  @PrimaryKey()
  @Field("integer")
  @Generated("increment")
  id!: number;

  @Field("string")
  label!: string;
}

/** Field with string default */
@Entity({ name: "ColStringDefault" })
class ColStringDefault {
  @PrimaryKeyField()
  id!: string;

  @Default("unknown")
  @Field("string")
  status!: string;
}

/** Field with numeric default */
@Entity({ name: "ColNumericDefault" })
class ColNumericDefault {
  @PrimaryKeyField()
  id!: string;

  @Default(0)
  @Field("integer")
  count!: number;
}

/** Field with boolean default */
@Entity({ name: "ColBoolDefault" })
class ColBoolDefault {
  @PrimaryKeyField()
  id!: string;

  @Default(false)
  @Field("boolean")
  active!: boolean;
}

/** Nullable field */
@Entity({ name: "ColNullable" })
class ColNullable {
  @PrimaryKeyField()
  id!: string;

  @Nullable()
  @Field("string")
  description!: string | null;
}

/** Entity with FK relation (ManyToOne owning side — FK column is generated) */
@Entity({ name: "ColFkChild" })
class ColFkChild {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  title!: string;

  @ManyToOne(() => ColParent, "childItems")
  parent!: ColParent | null;

  parentId!: string | null;
}

/** Entity where FK field is explicitly declared — should NOT be duplicated */
@Entity({ name: "ColFkChildExplicit" })
class ColFkChildExplicit {
  @PrimaryKeyField()
  id!: string;

  @Nullable()
  @Field("uuid")
  parentId!: string | null;

  @ManyToOne(() => ColParent, "explicitItems")
  parent!: ColParent | null;
}

// ---------------------------------------------------------------------------
// Helper to build EntityMetadata with custom MetaField overrides
// (used for features like collation and computed that aren't in decorator options)
// ---------------------------------------------------------------------------

const makeMetadata = (
  fields: MetaField[],
  overrides: Partial<EntityMetadata> = {},
): EntityMetadata =>
  ({
    target: class {},
    checks: [],
    entity: {
      decorator: "Entity",
      cache: null,
      comment: null,
      database: null,
      name: "InlineEntity",
      namespace: null,
    },
    extras: [],
    fields,
    generated: [],
    hooks: [],
    indexes: [],
    primaryKeys: ["id"],
    relations: [],
    schemas: [],
    uniques: [],
    versionKeys: [],
    ...overrides,
  }) as EntityMetadata;

const NS = null;
const NS_SCOPED = "app";
const OPTS = {};
const OPTS_SCOPED = { namespace: "app" };

describe("generateColumnDDL", () => {
  test("generates basic NOT NULL field columns", () => {
    const meta = getEntityMetadata(ColParent);
    expect(generateColumnDDL(meta, "col_parent", NS, OPTS)).toMatchSnapshot();
  });

  test("uuid field with gen_random_uuid() DEFAULT", () => {
    const meta = getEntityMetadata(ColUuidGenerated);
    expect(generateColumnDDL(meta, "col_uuid_generated", NS, OPTS)).toMatchSnapshot();
  });

  test("integer field with GENERATED ALWAYS AS IDENTITY", () => {
    const meta = getEntityMetadata(ColIntIdentity);
    expect(generateColumnDDL(meta, "col_int_identity", NS, OPTS)).toMatchSnapshot();
  });

  test("string field with string DEFAULT", () => {
    const meta = getEntityMetadata(ColStringDefault);
    expect(generateColumnDDL(meta, "col_string_default", NS, OPTS)).toMatchSnapshot();
  });

  test("integer field with numeric DEFAULT", () => {
    const meta = getEntityMetadata(ColNumericDefault);
    expect(generateColumnDDL(meta, "col_numeric_default", NS, OPTS)).toMatchSnapshot();
  });

  test("boolean field with boolean DEFAULT", () => {
    const meta = getEntityMetadata(ColBoolDefault);
    expect(generateColumnDDL(meta, "col_bool_default", NS, OPTS)).toMatchSnapshot();
  });

  test("string field with COLLATE clause (inline metadata)", () => {
    const meta = makeMetadata([
      makeField("id", { type: "uuid" }),
      makeField("name", { collation: "en_US.utf8" }),
    ]);
    expect(generateColumnDDL(meta, "col_with_collation", NS, OPTS)).toMatchSnapshot();
  });

  test("nullable field omits NOT NULL", () => {
    const meta = getEntityMetadata(ColNullable);
    expect(generateColumnDDL(meta, "col_nullable", NS, OPTS)).toMatchSnapshot();
  });

  test("computed field emits GENERATED ALWAYS AS (expr) STORED", () => {
    const meta = makeMetadata([
      makeField("id", { type: "uuid" }),
      makeField("firstName"),
      makeField("lastName"),
      makeField("fullName", { type: "text", computed: "firstName || ' ' || lastName" }),
    ]);
    expect(generateColumnDDL(meta, "col_computed", NS, OPTS)).toMatchSnapshot();
  });

  test("FK relation adds an implicit FK column", () => {
    const meta = getEntityMetadata(ColFkChild);
    expect(generateColumnDDL(meta, "col_fk_child", NS, OPTS)).toMatchSnapshot();
  });

  test("does not duplicate FK column when field is explicitly declared", () => {
    const meta = getEntityMetadata(ColFkChildExplicit);
    const cols = generateColumnDDL(meta, "col_fk_child_explicit", NS, OPTS);
    // parentId should appear exactly once
    const parentIdCols = cols.filter((c) => c.includes('"parentId"'));
    expect(parentIdCols).toHaveLength(1);
    expect(cols).toMatchSnapshot();
  });

  test("uses schema-qualified type name when namespace is provided", () => {
    const meta = getEntityMetadata(ColParent);
    expect(
      generateColumnDDL(meta, "col_parent", NS_SCOPED, OPTS_SCOPED),
    ).toMatchSnapshot();
  });

  test("string field with single-quoted default escapes embedded quotes", () => {
    const meta = makeMetadata([
      makeField("id", { type: "uuid" }),
      makeField("label", { default: "it's default" }),
    ]);
    expect(generateColumnDDL(meta, "col_string_escape", NS, OPTS)).toMatchSnapshot();
  });

  test("function-based default is skipped (no DEFAULT clause emitted)", () => {
    const meta = makeMetadata([
      makeField("id", { type: "uuid" }),
      makeField("generated", { default: () => "value" }),
    ]);
    const cols = generateColumnDDL(meta, "col_func_default", NS, OPTS);
    // No DEFAULT should be emitted for function defaults
    expect(cols.some((c) => c.includes("DEFAULT"))).toBe(false);
    expect(cols).toMatchSnapshot();
  });

  test("array/object default is skipped (no DEFAULT clause emitted)", () => {
    const meta = makeMetadata([
      makeField("id", { type: "uuid" }),
      makeField("tags", { type: "array", default: ["a", "b"] as any }),
    ]);
    const cols = generateColumnDDL(meta, "col_array_default", NS, OPTS);
    expect(cols.some((c) => c.includes("DEFAULT"))).toBe(false);
    expect(cols).toMatchSnapshot();
  });

  test("does not duplicate FK column when naming strategy renames field key to match joinCol (key !== name dedup)", () => {
    // ColFkChildExplicit has parentId field (key="parentId").
    // After snake_case naming strategy: field.name becomes "parent_id", joinCol also becomes "parent_id".
    // The dedup check must use f.name (not f.key) to correctly match and skip the auto-generated column.
    const meta = getEntityMetadata(ColFkChildExplicit);
    const renamedMeta = applyNamingStrategy(meta, "snake");
    const cols = generateColumnDDL(renamedMeta, "col_fk_child_explicit", NS, OPTS);
    // "parent_id" should appear exactly once — the explicit field, not an extra auto-generated column
    const parentIdCols = cols.filter((c) => c.includes('"parent_id"'));
    expect(parentIdCols).toHaveLength(1);
    expect(cols).toMatchSnapshot();
  });
});
