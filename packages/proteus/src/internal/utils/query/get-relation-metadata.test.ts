import { makeField } from "../../__fixtures__/make-field";
import type { EntityMetadata, MetaRelation } from "../../entity/types/metadata";
import { ProteusError } from "../../../errors";

// Mock getEntityMetadata so we don't need a real decorator-decorated class
jest.mock("../../entity/metadata/get-entity-metadata", () => ({
  getEntityMetadata: jest.fn(),
}));

import { getEntityMetadata } from "../../entity/metadata/get-entity-metadata";
import { findRelationByKey, getRelationMetadata } from "./get-relation-metadata";

const mockGetEntityMetadata = getEntityMetadata as jest.MockedFunction<
  typeof getEntityMetadata
>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

class ForeignEntity {}

const makeForeignMeta = (name = "ForeignEntity"): EntityMetadata =>
  ({
    entity: { decorator: "Entity", name, namespace: null, comment: null },
    fields: [makeField("id", { type: "uuid" }), makeField("label", { type: "string" })],
    relations: [],
    primaryKeys: ["id"],
  }) as unknown as EntityMetadata;

const makeRelation = (overrides: Partial<MetaRelation> = {}): MetaRelation =>
  ({
    key: "profile",
    foreignConstructor: () => ForeignEntity,
    foreignKey: "user",
    findKeys: null,
    joinKeys: null,
    joinTable: null,
    options: {} as any,
    orderBy: null,
    type: "OneToOne",
    ...overrides,
  }) as MetaRelation;

const makeRootMetadata = (relations: Array<MetaRelation>): EntityMetadata =>
  ({
    entity: { decorator: "Entity", name: "RootEntity", namespace: null, comment: null },
    fields: [makeField("id", { type: "uuid" })],
    relations,
    primaryKeys: ["id"],
  }) as unknown as EntityMetadata;

// ---------------------------------------------------------------------------
// getRelationMetadata
// ---------------------------------------------------------------------------

describe("getRelationMetadata", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("calls getEntityMetadata with the resolved foreign constructor", () => {
    const foreignMeta = makeForeignMeta();
    mockGetEntityMetadata.mockReturnValue(foreignMeta);

    const relation = makeRelation();
    const result = getRelationMetadata(relation);

    expect(mockGetEntityMetadata).toHaveBeenCalledWith(ForeignEntity);
    expect(result).toBe(foreignMeta);
  });

  test("returns the metadata returned by getEntityMetadata", () => {
    const foreignMeta = makeForeignMeta("ProfileEntity");
    mockGetEntityMetadata.mockReturnValue(foreignMeta);

    const relation = makeRelation({ foreignConstructor: () => ForeignEntity });
    const result = getRelationMetadata(relation);

    expect(result.entity.name).toBe("ProfileEntity");
  });

  test("invokes foreignConstructor thunk each call", () => {
    const foreignMeta = makeForeignMeta();
    mockGetEntityMetadata.mockReturnValue(foreignMeta);

    const spy = jest.fn().mockReturnValue(ForeignEntity);
    const relation = makeRelation({ foreignConstructor: spy });

    getRelationMetadata(relation);
    getRelationMetadata(relation);

    expect(spy).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// findRelationByKey
// ---------------------------------------------------------------------------

describe("findRelationByKey", () => {
  test("returns the relation whose key matches", () => {
    const relation = makeRelation({ key: "profile" });
    const rootMeta = makeRootMetadata([relation]);

    const result = findRelationByKey(rootMeta, "profile");
    expect(result).toBe(relation);
  });

  test("returns the correct relation when multiple relations exist", () => {
    const profileRelation = makeRelation({ key: "profile", type: "OneToOne" });
    const postsRelation = makeRelation({ key: "posts", type: "OneToMany" });
    const rootMeta = makeRootMetadata([profileRelation, postsRelation]);

    const result = findRelationByKey(rootMeta, "posts");
    expect(result).toBe(postsRelation);
  });

  test("throws ProteusError when the relation key is not found", () => {
    const rootMeta = makeRootMetadata([makeRelation({ key: "profile" })]);

    expect(() => findRelationByKey(rootMeta, "nonexistent")).toThrow(ProteusError);
  });

  test("error message includes the missing relation key", () => {
    const rootMeta = makeRootMetadata([makeRelation({ key: "profile" })]);

    expect(() => findRelationByKey(rootMeta, "missingRelation")).toThrow(
      /Relation "missingRelation" not found/,
    );
  });

  test("error message includes the entity name", () => {
    const rootMeta = makeRootMetadata([]);

    expect(() => findRelationByKey(rootMeta, "tags")).toThrow(/entity "RootEntity"/);
  });

  test("throws ProteusError when relations array is empty", () => {
    const rootMeta = makeRootMetadata([]);

    expect(() => findRelationByKey(rootMeta, "anyRelation")).toThrow(ProteusError);
  });

  test("returns first relation when multiple have distinct keys", () => {
    const r1 = makeRelation({ key: "alpha" });
    const r2 = makeRelation({ key: "beta" });
    const r3 = makeRelation({ key: "gamma" });
    const rootMeta = makeRootMetadata([r1, r2, r3]);

    expect(findRelationByKey(rootMeta, "alpha")).toBe(r1);
    expect(findRelationByKey(rootMeta, "gamma")).toBe(r3);
  });
});
