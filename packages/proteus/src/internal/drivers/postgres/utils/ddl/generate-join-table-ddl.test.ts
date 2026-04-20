import { ProteusError } from "../../../../../errors";
import { TestCourse, TestStudent } from "../../../../__fixtures__/test-entities";
import type { EntityMetadata, MetaRelation } from "../../../../entity/types/metadata";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata";
import { generateJoinTableDDL } from "./generate-join-table-ddl";
import { Entity } from "../../../../../decorators/Entity";
import { Field } from "../../../../../decorators/Field";
import { JoinTable } from "../../../../../decorators/JoinTable";
import { ManyToMany } from "../../../../../decorators/ManyToMany";
import { ManyToOne } from "../../../../../decorators/ManyToOne";
import { OneToMany } from "../../../../../decorators/OneToMany";
import { PrimaryKeyField } from "../../../../../decorators/PrimaryKeyField";
import { describe, expect, test } from "vitest";

// ---------------------------------------------------------------------------
// Additional test entities at module scope
// ---------------------------------------------------------------------------

/** Non-M2M entity — generateJoinTableDDL should return empty output */
@Entity({ name: "JoinNonM2M" })
class JoinNonM2M {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;
}

/** M2M owning side — custom join table name */
@Entity({ name: "JoinTag" })
class JoinTag {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  label!: string;

  @ManyToMany(() => JoinPost, "tags" as any)
  posts!: JoinPost[];
}

@Entity({ name: "JoinPost" })
class JoinPost {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  title!: string;

  @JoinTable({ name: "post_tags" })
  @ManyToMany(() => JoinTag, "posts" as any)
  tags!: JoinTag[];
}

// ---------------------------------------------------------------------------
// Minimal EntityMetadata factory for inline tests
// ---------------------------------------------------------------------------

const makeMeta = (
  target: new () => any,
  relations: MetaRelation[],
  overrides: Partial<EntityMetadata> = {},
): EntityMetadata =>
  ({
    target,
    checks: [],
    entity: {
      decorator: "Entity",
      cache: null,
      comment: null,
      database: null,
      name: target.name,
      namespace: null,
    },
    extras: [],
    fields: [],
    generated: [],
    hooks: [],
    indexes: [],
    primaryKeys: ["id"],
    relations,
    schemas: [],
    uniques: [],
    versionKeys: [],
    ...overrides,
  }) as EntityMetadata;

const makeRelation = (overrides: Partial<MetaRelation>): MetaRelation =>
  ({
    key: "items",
    foreignConstructor: () => class {},
    foreignKey: "owner",
    findKeys: null,
    joinKeys: null,
    joinTable: null,
    options: {
      deferrable: false,
      initiallyDeferred: false,
      loading: { eager: false, lazy: false },
      nullable: true,
      onDestroy: "ignore",
      onInsert: "ignore",
      onSoftDestroy: "ignore",
      onUpdate: "ignore",
      strategy: null,
    },
    orderBy: null,
    type: "ManyToMany",
    ...overrides,
  }) as MetaRelation;

const NS = null;
const NS_SCOPED = "social";
const OPTS = {};

describe("generateJoinTableDDL", () => {
  test("returns empty tables and indexes for non-M2M entity", () => {
    const meta = getEntityMetadata(JoinNonM2M);
    const result = generateJoinTableDDL(meta, NS, OPTS);
    expect(result.tables).toEqual([]);
    expect(result.indexes).toEqual([]);
  });

  test("generates join table DDL for TestStudent (both M2M sides produce a table)", () => {
    // Both sides of a ManyToMany generate the join table — the code
    // uses joinTable (string|boolean|null) and joinKeys to decide.
    // TestStudent has joinKeys set (resolved from the inverse), so it also emits.
    const meta = getEntityMetadata(TestStudent);
    const result = generateJoinTableDDL(meta, NS, OPTS);
    expect(result).toMatchSnapshot();
  });

  test("generates join table DDL for TestCourse (owning side with hasJoinTable)", () => {
    const meta = getEntityMetadata(TestCourse);
    const result = generateJoinTableDDL(meta, NS, OPTS);
    expect(result).toMatchSnapshot();
  });

  test("join table has CREATE TABLE IF NOT EXISTS statement", () => {
    const meta = getEntityMetadata(TestCourse);
    const result = generateJoinTableDDL(meta, NS, OPTS);
    expect(result.tables[0]).toMatch(/^CREATE TABLE IF NOT EXISTS/);
  });

  test("join table has PRIMARY KEY composed of both FK columns", () => {
    const meta = getEntityMetadata(TestCourse);
    const result = generateJoinTableDDL(meta, NS, OPTS);
    expect(result.tables[0]).toContain("PRIMARY KEY");
  });

  test("join table has ON DELETE CASCADE ON UPDATE CASCADE on both FK columns", () => {
    const meta = getEntityMetadata(TestCourse);
    const result = generateJoinTableDDL(meta, NS, OPTS);
    const cascadeCount = (
      result.tables[0].match(/ON DELETE CASCADE ON UPDATE CASCADE/g) ?? []
    ).length;
    expect(cascadeCount).toBe(2);
  });

  test("generates a reverse-side index on the foreign FK column", () => {
    const meta = getEntityMetadata(TestCourse);
    const result = generateJoinTableDDL(meta, NS, OPTS);
    expect(result.indexes).toHaveLength(1);
    expect(result.indexes[0]).toMatch(/^CREATE INDEX IF NOT EXISTS/);
    expect(result.indexes[0]).toMatch(/"idx_[A-Za-z0-9_-]{11}"/);
  });

  test("generates join table with custom joinTable name", () => {
    const meta = getEntityMetadata(JoinPost);
    const result = generateJoinTableDDL(meta, NS, OPTS);
    expect(result).toMatchSnapshot();
    expect(result.tables[0]).toContain('"post_tags"');
  });

  test("uses schema-qualified join table name when namespace is provided", () => {
    const meta = getEntityMetadata(TestCourse);
    const result = generateJoinTableDDL(meta, NS_SCOPED, { namespace: NS_SCOPED });
    expect(result.tables[0]).toContain('"social"');
    expect(result).toMatchSnapshot();
  });

  test("skips ManyToMany relation where joinTable is boolean true (not a string) without error", () => {
    // The isString(relation.joinTable) guard in generateJoinTableDDL means a boolean `true`
    // value is silently skipped. This can occur when metadata is constructed directly
    // (not through the decorator pipeline which always resolves booleans to strings).
    class BooleanJoinOwner {}
    const relation = makeRelation({
      joinTable: true,
      joinKeys: { ownerId: "id" },
    });
    const meta = makeMeta(BooleanJoinOwner, [relation]);
    const result = generateJoinTableDDL(meta, NS, OPTS);
    expect(result.tables).toEqual([]);
    expect(result.indexes).toEqual([]);
  });
});
