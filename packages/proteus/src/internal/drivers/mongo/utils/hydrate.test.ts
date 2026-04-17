import type { EntityMetadata, MetaField } from "../../../entity/types/metadata";

// Mock dependencies before importing the module under test
jest.mock("../../../entity/utils/default-hydrate-entity", () => ({
  defaultHydrateEntity: jest.fn((row: any, _meta: any, _opts: any) => row),
}));

jest.mock("../../../entity/utils/resolve-polymorphic-metadata", () => ({
  resolvePolymorphicMetadata: jest.fn((_row: any, meta: any) => meta),
}));

import { hydrateEntity, hydrateEntities } from "./hydrate";
import { defaultHydrateEntity } from "../../../entity/utils/default-hydrate-entity";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeField = (key: string, name?: string): MetaField =>
  ({
    key,
    name: name ?? key,
    type: "string",
  }) as unknown as MetaField;

const makeMetadata = (
  fields: Array<MetaField>,
  primaryKeys: Array<string> = ["id"],
): EntityMetadata =>
  ({
    entity: { name: "TestEntity" },
    fields,
    primaryKeys,
    inheritance: null,
  }) as unknown as EntityMetadata;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("hydrateEntity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should map _id back to PK field for simple document", () => {
    const metadata = makeMetadata([makeField("id"), makeField("name")]);

    const doc = { _id: "abc-123", name: "John" };
    hydrateEntity(doc, metadata);

    expect(defaultHydrateEntity).toHaveBeenCalledWith(
      expect.objectContaining({ id: "abc-123", name: "John" }),
      metadata,
      { snapshot: true, hooks: true },
    );
  });

  test("should decompose compound _id into individual PK fields", () => {
    const metadata = makeMetadata(
      [makeField("tenantId"), makeField("userId"), makeField("name")],
      ["tenantId", "userId"],
    );

    const doc = {
      _id: { tenantId: "t1", userId: "u1" },
      name: "John",
    };

    hydrateEntity(doc, metadata);

    expect(defaultHydrateEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        userId: "u1",
        name: "John",
      }),
      metadata,
      { snapshot: true, hooks: true },
    );
  });

  test("should map DB field names back to entity keys", () => {
    const metadata = makeMetadata([
      makeField("id"),
      makeField("emailAddress", "email_addr"),
    ]);

    const doc = { _id: "abc", email_addr: "test@example.com" };
    hydrateEntity(doc, metadata);

    expect(defaultHydrateEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "abc",
        emailAddress: "test@example.com",
      }),
      metadata,
      { snapshot: true, hooks: true },
    );
  });

  test("should pass through unknown fields (e.g. FK columns from relations)", () => {
    const metadata = makeMetadata([makeField("id"), makeField("name")]);

    const doc = { _id: "abc", name: "John", parentId: "parent-1" };
    hydrateEntity(doc, metadata);

    expect(defaultHydrateEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "abc",
        name: "John",
        parentId: "parent-1",
      }),
      metadata,
      { snapshot: true, hooks: true },
    );
  });

  test("should handle null values in document", () => {
    const metadata = makeMetadata([makeField("id"), makeField("nickname")]);

    const doc = { _id: "abc", nickname: null };
    hydrateEntity(doc, metadata);

    expect(defaultHydrateEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "abc",
        nickname: null,
      }),
      metadata,
      { snapshot: true, hooks: true },
    );
  });
});

describe("hydrateEntities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should hydrate multiple documents", () => {
    const metadata = makeMetadata([makeField("id"), makeField("name")]);

    const docs = [
      { _id: "a", name: "Alice" },
      { _id: "b", name: "Bob" },
    ];

    const results = hydrateEntities(docs, metadata);
    expect(results).toHaveLength(2);
    expect(defaultHydrateEntity).toHaveBeenCalledTimes(2);
  });

  test("should return empty array for empty docs", () => {
    const metadata = makeMetadata([makeField("id")]);
    const results = hydrateEntities([], metadata);
    expect(results).toEqual([]);
  });
});
