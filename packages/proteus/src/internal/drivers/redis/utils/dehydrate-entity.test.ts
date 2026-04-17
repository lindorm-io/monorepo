import type {
  EntityMetadata,
  MetaField,
  MetaRelation,
} from "../../../entity/types/metadata";
import { dehydrateToRow } from "./dehydrate-entity";

// ─── Module Mocks ────────────────────────────────────────────────────────────

jest.mock("../../../entity/utils/resolve-join-key-value", () => ({
  resolveJoinKeyValue: jest.fn(),
}));

import { resolveJoinKeyValue } from "../../../entity/utils/resolve-join-key-value";

const mockResolveJoinKeyValue = resolveJoinKeyValue as jest.MockedFunction<
  typeof resolveJoinKeyValue
>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeField = (overrides: Partial<MetaField> = {}): MetaField =>
  ({
    key: "name",
    decorator: "Field",
    type: "string",
    computed: null,
    embedded: null,
    encrypted: null,
    transform: null,
    nullable: false,
    readonly: false,
    name: "name",
    ...overrides,
  }) as unknown as MetaField;

const makeRelation = (overrides: Partial<MetaRelation> = {}): MetaRelation =>
  ({
    type: "ManyToOne",
    key: "author",
    joinKeys: { authorId: "id" },
    foreignKey: "id",
    ...overrides,
  }) as unknown as MetaRelation;

const makeMetadata = (
  fields: Array<MetaField>,
  relations: Array<MetaRelation> = [],
  extra: Partial<EntityMetadata> = {},
): EntityMetadata =>
  ({
    fields,
    relations,
    relationIds: [],
    relationCounts: [],
    ...extra,
  }) as unknown as EntityMetadata;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("dehydrateToRow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should extract simple field values from entity", () => {
    const fields = [
      makeField({ key: "id", type: "uuid" }),
      makeField({ key: "name", type: "string" }),
      makeField({ key: "age", type: "integer" }),
    ];
    const metadata = makeMetadata(fields);
    const entity = { id: "abc", name: "Test", age: 30 };

    expect(dehydrateToRow(entity as any, metadata)).toMatchSnapshot();
  });

  test("should skip computed fields", () => {
    const fields = [
      makeField({ key: "name", type: "string" }),
      makeField({ key: "fullName", type: "string", computed: "CONCAT(first, last)" }),
    ];
    const metadata = makeMetadata(fields);
    const entity = { name: "Test", fullName: "Full Name" };

    const result = dehydrateToRow(entity as any, metadata);

    expect(result).toMatchSnapshot();
    expect(result).not.toHaveProperty("fullName");
  });

  test("should skip virtual relationId properties", () => {
    const fields = [makeField({ key: "name", type: "string" })];
    const metadata = makeMetadata(fields, [], {
      relationIds: [{ key: "authorId", relationKey: "author", column: null }],
    } as any);
    const entity = { name: "Test", authorId: "a1" };

    expect(dehydrateToRow(entity as any, metadata)).toMatchSnapshot();
  });

  test("should skip virtual relationCount properties", () => {
    const fields = [makeField({ key: "name", type: "string" })];
    const metadata = makeMetadata(fields, [], {
      relationCounts: [{ key: "commentCount", relationKey: "comments" }],
    } as any);
    const entity = { name: "Test", commentCount: 5 };

    expect(dehydrateToRow(entity as any, metadata)).toMatchSnapshot();
  });

  test("should apply transform.to() when present", () => {
    const fields = [
      makeField({
        key: "data",
        type: "string",
        transform: {
          to: (v: unknown) => `encoded:${v}`,
          from: (v: unknown) => v,
        },
      }),
    ];
    const metadata = makeMetadata(fields);
    const entity = { data: "raw" };

    expect(dehydrateToRow(entity as any, metadata)).toMatchSnapshot();
  });

  test("should not apply transform when value is null", () => {
    const toMock = jest.fn();
    const fields = [
      makeField({
        key: "data",
        type: "string",
        transform: { to: toMock, from: (v: unknown) => v },
      }),
    ];
    const metadata = makeMetadata(fields);
    const entity = { data: null };

    dehydrateToRow(entity as any, metadata);

    expect(toMock).not.toHaveBeenCalled();
  });

  test("should handle embedded fields", () => {
    const fields = [
      makeField({
        key: "address.street",
        type: "string",
        embedded: { parentKey: "address", constructor: () => Object },
      }),
      makeField({
        key: "address.city",
        type: "string",
        embedded: { parentKey: "address", constructor: () => Object },
      }),
    ];
    const metadata = makeMetadata(fields);
    const entity = { address: { street: "Main St", city: "Springfield" } };

    expect(dehydrateToRow(entity as any, metadata)).toMatchSnapshot();
  });

  test("should handle null embedded parent", () => {
    const fields = [
      makeField({
        key: "address.street",
        type: "string",
        embedded: { parentKey: "address", constructor: () => Object },
      }),
    ];
    const metadata = makeMetadata(fields);
    const entity = { address: null };

    expect(dehydrateToRow(entity as any, metadata)).toMatchSnapshot();
  });

  test("should extract FK columns from owning relations", () => {
    const fields = [makeField({ key: "name", type: "string" })];
    const relations = [makeRelation()];
    const metadata = makeMetadata(fields, relations);

    mockResolveJoinKeyValue.mockReturnValue("author-1");

    const entity = { name: "Test", author: { id: "author-1" } };

    expect(dehydrateToRow(entity as any, metadata)).toMatchSnapshot();
  });

  test("should set null for missing FK values", () => {
    const fields = [makeField({ key: "name", type: "string" })];
    const relations = [makeRelation()];
    const metadata = makeMetadata(fields, relations);

    mockResolveJoinKeyValue.mockReturnValue(null);

    const entity = { name: "Test", author: null };

    expect(dehydrateToRow(entity as any, metadata)).toMatchSnapshot();
  });

  test("should skip ManyToMany relations", () => {
    const fields = [makeField({ key: "name", type: "string" })];
    const relations = [makeRelation({ type: "ManyToMany", joinKeys: { postId: "id" } })];
    const metadata = makeMetadata(fields, relations);

    const entity = { name: "Test" };

    const result = dehydrateToRow(entity as any, metadata);

    expect(result).toMatchSnapshot();
    expect(mockResolveJoinKeyValue).not.toHaveBeenCalled();
  });

  test("should skip FK column already handled by fields", () => {
    const fields = [
      makeField({ key: "name", type: "string" }),
      makeField({ key: "authorId", type: "uuid" }),
    ];
    const relations = [makeRelation()];
    const metadata = makeMetadata(fields, relations);

    const entity = { name: "Test", authorId: "author-1" };

    const result = dehydrateToRow(entity as any, metadata);

    expect(result).toMatchSnapshot();
    expect(mockResolveJoinKeyValue).not.toHaveBeenCalled();
  });
});
