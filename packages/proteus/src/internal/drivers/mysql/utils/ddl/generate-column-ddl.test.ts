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
import { generateColumnDDL } from "./generate-column-ddl";
import { describe, expect, test } from "vitest";

// ---------------------------------------------------------------------------
// Test entities — must be at module scope for stage-3 decorator execution.
// ---------------------------------------------------------------------------

@Entity({ name: "MysColParent" })
class MysColParent {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @OneToMany(() => MysColFkChild, "parent")
  childItems!: MysColFkChild[];

  @OneToMany(() => MysColFkChildExplicit, "parent")
  explicitItems!: MysColFkChildExplicit[];
}

/** UUID primary key (app-generated) */
@Entity({ name: "MysColUuidGenerated" })
class MysColUuidGenerated {
  @PrimaryKey()
  @Field("uuid")
  @Generated("uuid")
  id!: string;

  @Field("string")
  title!: string;
}

/** Integer primary key (AUTO_INCREMENT) */
@Entity({ name: "MysColIntIdentity" })
class MysColIntIdentity {
  @PrimaryKey()
  @Field("integer")
  @Generated("increment")
  id!: number;

  @Field("string")
  label!: string;
}

/** Field with string default */
@Entity({ name: "MysColStringDefault" })
class MysColStringDefault {
  @PrimaryKeyField()
  id!: string;

  @Default("unknown")
  @Field("string")
  status!: string;
}

/** Field with numeric default */
@Entity({ name: "MysColNumericDefault" })
class MysColNumericDefault {
  @PrimaryKeyField()
  id!: string;

  @Default(0)
  @Field("integer")
  count!: number;
}

/** Field with boolean default */
@Entity({ name: "MysColBoolDefault" })
class MysColBoolDefault {
  @PrimaryKeyField()
  id!: string;

  @Default(false)
  @Field("boolean")
  active!: boolean;
}

/** Nullable field */
@Entity({ name: "MysColNullable" })
class MysColNullable {
  @PrimaryKeyField()
  id!: string;

  @Nullable()
  @Field("string")
  description!: string | null;
}

/** Entity with FK relation (ManyToOne owning side) */
@Entity({ name: "MysColFkChild" })
class MysColFkChild {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  title!: string;

  @ManyToOne(() => MysColParent, "childItems")
  parent!: MysColParent | null;

  parentId!: string | null;
}

/** Entity where FK field is explicitly declared */
@Entity({ name: "MysColFkChildExplicit" })
class MysColFkChildExplicit {
  @PrimaryKeyField()
  id!: string;

  @Nullable()
  @Field("uuid")
  parentId!: string | null;

  @ManyToOne(() => MysColParent, "explicitItems")
  parent!: MysColParent | null;
}

// ---------------------------------------------------------------------------
// Helper
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
      comment: null,
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

describe("generateColumnDDL (MySQL)", () => {
  test("generates basic NOT NULL field columns", () => {
    const meta = getEntityMetadata(MysColParent);
    expect(generateColumnDDL(meta, "mys_col_parent")).toMatchSnapshot();
  });

  test("uuid field — no DEFAULT (app-generated)", () => {
    const meta = getEntityMetadata(MysColUuidGenerated);
    expect(generateColumnDDL(meta, "mys_col_uuid_generated")).toMatchSnapshot();
  });

  test("integer field with AUTO_INCREMENT", () => {
    const meta = getEntityMetadata(MysColIntIdentity);
    expect(generateColumnDDL(meta, "mys_col_int_identity")).toMatchSnapshot();
  });

  test("string field with string DEFAULT", () => {
    const meta = getEntityMetadata(MysColStringDefault);
    expect(generateColumnDDL(meta, "mys_col_string_default")).toMatchSnapshot();
  });

  test("integer field with numeric DEFAULT", () => {
    const meta = getEntityMetadata(MysColNumericDefault);
    expect(generateColumnDDL(meta, "mys_col_numeric_default")).toMatchSnapshot();
  });

  test("boolean field with boolean DEFAULT (integer 0/1)", () => {
    const meta = getEntityMetadata(MysColBoolDefault);
    expect(generateColumnDDL(meta, "mys_col_bool_default")).toMatchSnapshot();
  });

  test("nullable field omits NOT NULL", () => {
    const meta = getEntityMetadata(MysColNullable);
    expect(generateColumnDDL(meta, "mys_col_nullable")).toMatchSnapshot();
  });

  test("computed field emits GENERATED ALWAYS AS (expr) STORED", () => {
    const meta = makeMetadata([
      makeField("id", { type: "uuid" }),
      makeField("firstName"),
      makeField("lastName"),
      makeField("fullName", {
        type: "text",
        computed: "CONCAT(firstName, ' ', lastName)",
      }),
    ]);
    expect(generateColumnDDL(meta, "mys_computed")).toMatchSnapshot();
  });

  test("enum field emits inline ENUM type", () => {
    const meta = makeMetadata([
      makeField("id", { type: "uuid" }),
      makeField("status", {
        type: "enum",
        enum: { Active: "active", Inactive: "inactive", Pending: "pending" },
      }),
    ]);
    expect(generateColumnDDL(meta, "mys_enum")).toMatchSnapshot();
  });

  test("FK relation adds an implicit FK column", () => {
    const meta = getEntityMetadata(MysColFkChild);
    expect(generateColumnDDL(meta, "mys_col_fk_child")).toMatchSnapshot();
  });

  test("does not duplicate FK column when field is explicitly declared", () => {
    const meta = getEntityMetadata(MysColFkChildExplicit);
    const cols = generateColumnDDL(meta, "mys_col_fk_child_explicit");
    const parentIdCols = cols.filter((c) => c.includes("`parentId`"));
    expect(parentIdCols).toHaveLength(1);
    expect(cols).toMatchSnapshot();
  });

  test("string field with single-quoted default escapes embedded quotes", () => {
    const meta = makeMetadata([
      makeField("id", { type: "uuid" }),
      makeField("label", { default: "it's default" }),
    ]);
    expect(generateColumnDDL(meta, "mys_string_escape")).toMatchSnapshot();
  });

  test("function-based default is skipped (no DEFAULT clause emitted)", () => {
    const meta = makeMetadata([
      makeField("id", { type: "uuid" }),
      makeField("generated", { default: () => "value" }),
    ]);
    const cols = generateColumnDDL(meta, "mys_func_default");
    expect(cols.some((c) => c.includes("DEFAULT"))).toBe(false);
    expect(cols).toMatchSnapshot();
  });
});
