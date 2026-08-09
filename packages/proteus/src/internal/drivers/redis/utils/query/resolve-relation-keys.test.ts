import { describe, expect, test } from "vitest";
import { makeField } from "../../../../__fixtures__/make-field.js";
import type { EntityMetadata, MetaRelation } from "../../../../entity/types/metadata.js";
import {
  addressableByKey,
  resolveManyToManyLink,
  resolveRelationKeys,
} from "./resolve-relation-keys.js";

const makeRelation = (overrides: Partial<MetaRelation> = {}): MetaRelation =>
  ({
    key: "posts",
    foreignConstructor: () => class Post {},
    foreignKey: "author",
    findKeys: null,
    joinKeys: null,
    joinTable: null,
    options: {} as never,
    orderBy: null,
    type: "OneToMany",
    ...overrides,
  }) as MetaRelation;

// Columns are spelled "snake" throughout, so a case that resolved a column
// verbatim as a property key would read a hash field that does not exist.
const userMetadata: EntityMetadata = {
  entity: { name: "User" },
  fields: [makeField("id", { type: "uuid" })],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const postMetadata: EntityMetadata = {
  entity: { name: "Post" },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("title"),
    makeField("authorId", { type: "uuid", name: "author_id" }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

describe("resolveRelationKeys", () => {
  // A Redis hash field is ALWAYS the property key, so both halves have to come
  // back as property keys even though the metadata names columns.
  test("inverse relation reads the root primary key against the foreign property", () => {
    const relation = makeRelation({ findKeys: { author_id: "id" } });

    expect(resolveRelationKeys(relation, userMetadata, postMetadata)).toEqual([
      { localKey: "id", foreignKey: "authorId" },
    ]);
  });

  test("owning relation reads the root foreign-key property against the foreign id", () => {
    const relation = makeRelation({
      key: "author",
      type: "ManyToOne",
      joinKeys: { author_id: "id" },
    });

    expect(resolveRelationKeys(relation, postMetadata, userMetadata)).toEqual([
      { localKey: "authorId", foreignKey: "id" },
    ]);
  });

  test("a composite key resolves every pair", () => {
    const scopedMetadata: EntityMetadata = {
      entity: { name: "Scoped" },
      fields: [makeField("tenantId", { name: "tenant_id" }), makeField("id")],
      relations: [],
      primaryKeys: ["tenantId", "id"],
    } as unknown as EntityMetadata;

    const relation = makeRelation({
      key: "scoped",
      type: "ManyToOne",
      joinKeys: { tenant_id: "tenantId", scoped_id: "id" },
    });

    expect(resolveRelationKeys(relation, postMetadata, scopedMetadata)).toEqual([
      { localKey: "tenantId", foreignKey: "tenantId" },
      { localKey: "scopedId", foreignKey: "id" },
    ]);
  });
});

describe("resolveManyToManyLink", () => {
  const mirror = makeRelation({
    key: "lefts",
    type: "ManyToMany",
    foreignKey: "rights",
    findKeys: { right_id: "id" },
    joinTable: "left_x_right",
  });

  const rightMetadata: EntityMetadata = {
    entity: { name: "Right" },
    fields: [makeField("id", { type: "uuid" }), makeField("label")],
    relations: [mirror],
    primaryKeys: ["id"],
  } as unknown as EntityMetadata;

  const relation = makeRelation({
    key: "rights",
    type: "ManyToMany",
    foreignKey: "lefts",
    findKeys: { left_id: "id" },
    joinTable: "left_x_right",
  });

  // The SET key is named after the ROOT's join column and holds the FOREIGN
  // side's primary keys — exactly what createRedisJoinTableOps writes.
  test("reads the SET naming out of the relation and its mirror", () => {
    expect(resolveManyToManyLink(relation, rightMetadata)).toEqual({
      joinTable: "left_x_right",
      joinColumn: "left_id",
      localKey: "id",
      foreignKey: "id",
    });
  });

  test("returns null when the mirror relation is missing", () => {
    const orphaned = { ...rightMetadata, relations: [] } as unknown as EntityMetadata;

    expect(resolveManyToManyLink(relation, orphaned)).toBeNull();
  });
});

describe("addressableByKey", () => {
  // The primary key is the only index Redis has, so this is the whole test of
  // whether a relation costs a scan.
  test("is true when the match keys are exactly the foreign primary key", () => {
    expect(addressableByKey(["id"], postMetadata)).toBe(true);
  });

  test("is false for an ordinary column with nothing pointing at it", () => {
    expect(addressableByKey(["authorId"], postMetadata)).toBe(false);
  });

  test("is false when only part of a composite primary key is matched", () => {
    const scopedMetadata = {
      primaryKeys: ["tenantId", "id"],
    } as unknown as EntityMetadata;

    expect(addressableByKey(["id"], scopedMetadata)).toBe(false);
    expect(addressableByKey(["id", "tenantId"], scopedMetadata)).toBe(true);
  });
});
