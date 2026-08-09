import { beforeEach, describe, expect, test, vi, type MockedFunction } from "vitest";
import { makeField } from "../../../../__fixtures__/make-field.js";
import type { EntityMetadata, MetaRelation } from "../../../../entity/types/metadata.js";
import type { IncludeSpec } from "../../../../types/query.js";
import type { IncludeLookupContext } from "./compile-include-lookup.js";

vi.mock("../../../../utils/query/get-relation-metadata.js");

import {
  findRelationByKey,
  getRelationMetadata,
} from "../../../../utils/query/get-relation-metadata.js";
import { compileIncludeLookup, relationAlias } from "./compile-include-lookup.js";

const mockFindRelationByKey = findRelationByKey as MockedFunction<
  typeof findRelationByKey
>;
const mockGetRelationMetadata = getRelationMetadata as MockedFunction<
  typeof getRelationMetadata
>;

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

const makeInclude = (overrides: Partial<IncludeSpec> = {}): IncludeSpec => ({
  relation: "posts",
  required: false,
  strategy: "join",
  select: null,
  where: null,
  ...overrides,
});

const userMetadata: EntityMetadata = {
  entity: { name: "User" },
  fields: [makeField("id", { type: "uuid" }), makeField("name")],
  relations: [],
  primaryKeys: ["id"],
  filters: [],
  inheritance: null,
} as unknown as EntityMetadata;

const postMetadata: EntityMetadata = {
  entity: { name: "Post" },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("title"),
    makeField("body", { nullable: true }),
    makeField("authorId", { type: "uuid", name: "author_id", nullable: true }),
  ],
  relations: [],
  primaryKeys: ["id"],
  filters: [],
  inheritance: null,
} as unknown as EntityMetadata;

const ctx: IncludeLookupContext = {
  rootMetadata: userMetadata,
  withDeleted: false,
  versionTimestamp: null,
};

const stage = (stages: Array<Record<string, unknown>>, name: string) =>
  stages.find((s) => name in s)?.[name] as Record<string, unknown> | undefined;

describe("compileIncludeLookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRelationMetadata.mockReturnValue(postMetadata);
  });

  test("relationAlias keeps the lookup output out of the document's own keys", () => {
    expect(relationAlias("posts")).toBe("__rel_posts");
  });

  test("matches the foreign column against the root id, both sides null-guarded", () => {
    mockFindRelationByKey.mockReturnValue(
      makeRelation({ findKeys: { author_id: "id" } }),
    );

    expect(compileIncludeLookup(makeInclude(), ctx)).toMatchSnapshot();
  });

  test("an owning relation matches the root's foreign key against the foreign id", () => {
    mockFindRelationByKey.mockReturnValue(
      makeRelation({ key: "author", type: "ManyToOne", joinKeys: { author_id: "id" } }),
    );
    mockGetRelationMetadata.mockReturnValue(userMetadata);

    expect(
      compileIncludeLookup(makeInclude({ relation: "author" }), {
        ...ctx,
        rootMetadata: postMetadata,
      }),
    ).toMatchSnapshot();
  });

  // INNER-vs-LEFT on an array is "did the lookup find anything": the `.0`
  // existence match is what `$unwind` with preserveNullAndEmptyArrays: false
  // would decide, without fanning a to-many root out into one document per row.
  test("required adds an existence match on the lookup result", () => {
    mockFindRelationByKey.mockReturnValue(
      makeRelation({ findKeys: { author_id: "id" } }),
    );

    const stages = compileIncludeLookup(makeInclude({ required: true }), ctx);

    expect(stages).toHaveLength(2);
    expect(stages[1]).toEqual({ $match: { "__rel_posts.0": { $exists: true } } });
  });

  test("an optional relation adds no stage beyond the lookup itself", () => {
    mockFindRelationByKey.mockReturnValue(
      makeRelation({ findKeys: { author_id: "id" } }),
    );

    expect(compileIncludeLookup(makeInclude(), ctx)).toHaveLength(1);
  });

  // The relation's own `where` filters the relation and never the root, so it
  // sits INSIDE the sub-pipeline alongside the foreign entity's system filters.
  test("a relation where is applied inside the sub-pipeline", () => {
    mockFindRelationByKey.mockReturnValue(
      makeRelation({ findKeys: { author_id: "id" } }),
    );

    const [lookup] = compileIncludeLookup(
      makeInclude({ where: { title: "Only This" } }),
      ctx,
    );
    const pipeline = (lookup.$lookup as { pipeline: Array<Record<string, unknown>> })
      .pipeline;

    expect(pipeline[1]).toEqual({ $match: { title: "Only This" } });
  });

  // `select` narrows the columns and decides nothing else: the foreign primary
  // key is projected whether or not it was named, because the relation is
  // hydrated through it.
  test("a select projects the caller's columns plus the keys the driver needs", () => {
    mockFindRelationByKey.mockReturnValue(
      makeRelation({ findKeys: { author_id: "id" } }),
    );

    const [lookup] = compileIncludeLookup(makeInclude({ select: ["title"] }), ctx);
    const pipeline = (lookup.$lookup as { pipeline: Array<Record<string, unknown>> })
      .pipeline;

    expect(stage(pipeline, "$project")).toEqual({ title: 1, _id: 1 });
  });

  // An @OrderBy column is read whether the projection named it or not, and the
  // sort runs BEFORE the projection so omitting it cannot stop the ordering.
  test("an ordered relation sorts inside the sub-pipeline, ahead of the projection", () => {
    mockFindRelationByKey.mockReturnValue(
      makeRelation({ findKeys: { author_id: "id" }, orderBy: { title: "DESC" } }),
    );

    const [lookup] = compileIncludeLookup(makeInclude({ select: ["body"] }), ctx);
    const pipeline = (lookup.$lookup as { pipeline: Array<Record<string, unknown>> })
      .pipeline;

    expect(pipeline.findIndex((s) => "$sort" in s)).toBeLessThan(
      pipeline.findIndex((s) => "$project" in s),
    );
    expect(stage(pipeline, "$sort")).toEqual({ title: -1 });
    expect(stage(pipeline, "$project")).toEqual({ body: 1, title: 1, _id: 1 });
  });

  // Counting only has to know whether a required relation matched, so the
  // relation is cut to one row and neither ordered nor projected.
  test("minimal cuts the relation to a single row", () => {
    mockFindRelationByKey.mockReturnValue(
      makeRelation({ findKeys: { author_id: "id" }, orderBy: { title: "DESC" } }),
    );

    const [lookup] = compileIncludeLookup(makeInclude({ select: ["title"] }), ctx, true);
    const pipeline = (lookup.$lookup as { pipeline: Array<Record<string, unknown>> })
      .pipeline;

    expect(pipeline.at(-1)).toEqual({ $limit: 1 });
    expect(pipeline.some((s) => "$sort" in s || "$project" in s)).toBe(false);
  });

  describe("many-to-many", () => {
    const rightMetadata: EntityMetadata = {
      entity: { name: "Right" },
      fields: [makeField("id", { type: "uuid" }), makeField("label")],
      relations: [],
      primaryKeys: ["id"],
      filters: [],
      inheritance: null,
    } as unknown as EntityMetadata;

    const mirror = makeRelation({
      key: "lefts",
      type: "ManyToMany",
      foreignKey: "rights",
      findKeys: { right_id: "id" },
      joinTable: "left_x_right",
    });

    const relation = makeRelation({
      key: "rights",
      type: "ManyToMany",
      foreignKey: "lefts",
      findKeys: { left_id: "id" },
      joinTable: "left_x_right",
    });

    beforeEach(() => {
      mockFindRelationByKey.mockReturnValue(relation);
      mockGetRelationMetadata.mockReturnValue({
        ...rightMetadata,
        relations: [mirror],
      } as unknown as EntityMetadata);
    });

    test("hops through the join collection in a single lookup", () => {
      expect(
        compileIncludeLookup(makeInclude({ relation: "rights" }), ctx),
      ).toMatchSnapshot();
    });

    // A join row whose target is gone — deleted, or filtered out by the
    // relation's own where — must disappear rather than leave a hole.
    test("drops a join row whose target did not survive the inner lookup", () => {
      const [lookup] = compileIncludeLookup(makeInclude({ relation: "rights" }), ctx);
      const pipeline = (lookup.$lookup as { pipeline: Array<Record<string, unknown>> })
        .pipeline;

      expect(pipeline).toContainEqual({ $unwind: "$__link" });
      expect(
        pipeline.some((s) => "$unwind" in s && "preserveNullAndEmptyArrays" in s),
      ).toBe(false);
    });

    test("yields an empty relation when the mirror relation is missing", () => {
      mockGetRelationMetadata.mockReturnValue(rightMetadata);

      expect(compileIncludeLookup(makeInclude({ relation: "rights" }), ctx)).toEqual([
        { $set: { __rel_rights: [] } },
      ]);
    });
  });
});
