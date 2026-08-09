import { describe, expect, test } from "vitest";
import { makeField } from "../../../../__fixtures__/make-field.js";
import type { EntityMetadata, MetaRelation } from "../../../../entity/types/metadata.js";
import {
  isJoinTableRelation,
  resolveManyToManyJoin,
  resolveRelationJoin,
} from "./resolve-relation-join.js";

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

// Column names are the "snake" spellings, so every case below would still pass
// with a naive key↔column identity if the two never diverged.
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

describe("resolveRelationJoin", () => {
  // findKeys names the FOREIGN column and the ROOT property key, so each half
  // has to be read in the spelling of its own side.
  test("inverse relation matches the root primary key against the foreign column", () => {
    const relation = makeRelation({ findKeys: { author_id: "id" } });

    expect(resolveRelationJoin(relation, userMetadata, postMetadata)).toEqual([
      {
        localKey: "id",
        localDoc: "_id",
        foreignKey: "authorId",
        foreignDoc: "author_id",
      },
    ]);
  });

  // joinKeys names the LOCAL column and the FOREIGN property key — the mirror
  // image, which is why the two are resolved through different helpers.
  test("owning relation matches the root foreign key against the foreign id", () => {
    const relation = makeRelation({
      key: "author",
      type: "ManyToOne",
      joinKeys: { author_id: "id" },
    });

    expect(resolveRelationJoin(relation, postMetadata, userMetadata)).toEqual([
      {
        localKey: "authorId",
        localDoc: "author_id",
        foreignKey: "id",
        foreignDoc: "_id",
      },
    ]);
  });

  // A shared-primary-key one-to-one joins on `_id`, not on a column named after
  // the property — reading the column verbatim would address nothing.
  test("a foreign key that IS the primary key addresses _id", () => {
    const profileMetadata: EntityMetadata = {
      entity: { name: "Profile" },
      fields: [makeField("userId", { type: "uuid", name: "user_id" })],
      relations: [],
      primaryKeys: ["userId"],
    } as unknown as EntityMetadata;

    const relation = makeRelation({ key: "profile", findKeys: { user_id: "id" } });

    expect(resolveRelationJoin(relation, userMetadata, profileMetadata)).toEqual([
      { localKey: "id", localDoc: "_id", foreignKey: "userId", foreignDoc: "_id" },
    ]);
  });

  test("a composite primary key addresses one component of the compound id", () => {
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

    expect(resolveRelationJoin(relation, postMetadata, scopedMetadata)).toEqual([
      {
        localKey: "tenantId",
        localDoc: "tenant_id",
        foreignKey: "tenantId",
        foreignDoc: "_id.tenantId",
      },
      {
        localKey: "scopedId",
        localDoc: "scoped_id",
        foreignKey: "id",
        foreignDoc: "_id.id",
      },
    ]);
  });
});

describe("resolveManyToManyJoin", () => {
  const leftMetadata: EntityMetadata = {
    entity: { name: "Left" },
    fields: [makeField("id", { type: "uuid" }), makeField("label")],
    relations: [],
    primaryKeys: ["id"],
  } as unknown as EntityMetadata;

  const rightRelation = makeRelation({
    key: "lefts",
    type: "ManyToMany",
    foreignKey: "rights",
    findKeys: { right_id: "id" },
    joinTable: "left_x_right",
  });

  const rightMetadata: EntityMetadata = {
    entity: { name: "Right" },
    fields: [makeField("id", { type: "uuid" }), makeField("label")],
    relations: [rightRelation],
    primaryKeys: ["id"],
  } as unknown as EntityMetadata;

  const relation = makeRelation({
    key: "rights",
    type: "ManyToMany",
    foreignKey: "lefts",
    findKeys: { left_id: "id" },
    joinTable: "left_x_right",
  });

  test("reads both hops out of the relation and its mirror", () => {
    expect(resolveManyToManyJoin(relation, leftMetadata, rightMetadata)).toEqual({
      collection: "left_x_right",
      root: [{ joinColumn: "left_id", localKey: "id", localDoc: "_id" }],
      foreign: [{ joinColumn: "right_id", foreignKey: "id", foreignDoc: "_id" }],
    });
  });

  // Without the mirror there is no second hop, so there is no relation to read
  // — better to say so than to guess the foreign column.
  test("returns null when the mirror relation is missing", () => {
    const orphaned: EntityMetadata = {
      ...rightMetadata,
      relations: [],
    } as unknown as EntityMetadata;

    expect(resolveManyToManyJoin(relation, leftMetadata, orphaned)).toBeNull();
  });
});

describe("isJoinTableRelation", () => {
  test("is true only for a many-to-many with a named join table", () => {
    expect(
      isJoinTableRelation(makeRelation({ type: "ManyToMany", joinTable: "a_x_b" })),
    ).toBe(true);
    expect(
      isJoinTableRelation(makeRelation({ type: "ManyToMany", joinTable: true })),
    ).toBe(false);
    expect(isJoinTableRelation(makeRelation({ type: "OneToMany" }))).toBe(false);
  });
});
