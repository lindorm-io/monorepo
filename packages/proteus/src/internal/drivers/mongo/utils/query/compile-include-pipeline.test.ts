import { beforeEach, describe, expect, test, vi, type MockedFunction } from "vitest";
import { makeField } from "../../../../__fixtures__/make-field.js";
import type { EntityMetadata, MetaRelation } from "../../../../entity/types/metadata.js";
import type { IncludeSpec } from "../../../../types/query.js";

vi.mock("../../../../utils/query/get-relation-metadata.js");

import {
  findRelationByKey,
  getRelationMetadata,
} from "../../../../utils/query/get-relation-metadata.js";
import { compileIncludePipeline } from "./compile-include-pipeline.js";

const mockFindRelationByKey = findRelationByKey as MockedFunction<
  typeof findRelationByKey
>;
const mockGetRelationMetadata = getRelationMetadata as MockedFunction<
  typeof getRelationMetadata
>;

const relation = {
  key: "posts",
  foreignConstructor: () => class Post {},
  foreignKey: "author",
  findKeys: { author_id: "id" },
  joinKeys: null,
  joinTable: null,
  options: {} as never,
  orderBy: null,
  type: "OneToMany",
} as unknown as MetaRelation;

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
    makeField("authorId", { type: "uuid", name: "author_id", nullable: true }),
  ],
  relations: [],
  primaryKeys: ["id"],
  filters: [],
  inheritance: null,
} as unknown as EntityMetadata;

const base = {
  filter: {},
  includes: [makeInclude()],
  rootMetadata: userMetadata,
  withDeleted: false,
  versionTimestamp: null,
};

const names = (stages: Array<Record<string, unknown>>) =>
  stages.map((s) => Object.keys(s)[0]);

describe("compileIncludePipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(postMetadata);
  });

  test("matches, then looks up, then orders and paginates", () => {
    const pipeline = compileIncludePipeline({
      ...base,
      filter: { name: "Eve" },
      sort: { name: 1 },
      skip: 1,
      take: 2,
    });

    expect(names(pipeline)).toEqual(["$match", "$lookup", "$sort", "$skip", "$limit"]);
  });

  // Relations resolve BEFORE ordering and pagination, so a required one decides
  // which roots exist at all rather than quietly shrinking a page.
  test("a required relation is filtered before the page is cut", () => {
    const pipeline = compileIncludePipeline({
      ...base,
      includes: [makeInclude({ required: true })],
      sort: { name: 1 },
      take: 2,
    });

    expect(names(pipeline)).toEqual(["$lookup", "$match", "$sort", "$limit"]);
  });

  // A to-one relation is looked up through the root's OWN foreign key, so a
  // projection naming only the caller's columns must not run before the lookup.
  // Going last means the relation aliases have to be re-admitted.
  test("the root projection is last and re-admits the relation aliases", () => {
    const pipeline = compileIncludePipeline({
      ...base,
      projection: { name: 1, _id: 1 },
    });

    expect(names(pipeline)).toEqual(["$lookup", "$project"]);
    expect(pipeline.at(-1)).toEqual({
      $project: { name: 1, _id: 1, __rel_posts: 1 },
    });
  });

  // Counting only asks whether a root survives, and an optional relation can
  // never exclude one — so it is not materialised at all.
  test("minimal drops optional relations, ordering, pagination and projection", () => {
    const pipeline = compileIncludePipeline({
      ...base,
      filter: { name: "Eve" },
      sort: { name: 1 },
      skip: 1,
      take: 2,
      projection: { name: 1 },
      minimal: true,
    });

    expect(names(pipeline)).toEqual(["$match"]);
  });

  test("minimal keeps a required relation, because it decides the count", () => {
    const pipeline = compileIncludePipeline({
      ...base,
      includes: [makeInclude({ required: true })],
      minimal: true,
    });

    expect(names(pipeline)).toEqual(["$lookup", "$match"]);
  });

  test("an empty filter contributes no match stage", () => {
    expect(names(compileIncludePipeline(base))).toEqual(["$lookup"]);
  });
});
