import type { EntityMetadata, MetaField } from "../../../entity/types/metadata.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

// Mock dependencies before importing the module under test
vi.mock("../../../entity/utils/default-hydrate-entity.js", () => ({
  defaultHydrateEntity: vi.fn((row: any, _meta: any, _opts: any) => row),
}));

vi.mock("../../../entity/utils/resolve-polymorphic-metadata.js", () => ({
  resolvePolymorphicMetadata: vi.fn((_row: any, meta: any) => meta),
}));

import { hydrateEntity, hydrateEntities } from "./hydrate.js";
import { defaultHydrateEntity } from "../../../entity/utils/default-hydrate-entity.js";

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
    vi.clearAllMocks();
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
    vi.clearAllMocks();
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

describe("hydrateEntity typedJson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should map the sidecar doc key onto the meta dict key", () => {
    const typedField = {
      key: "payload",
      name: "payload",
      type: "json",
      typedJson: { name: null, column: "payload__typemeta" },
    } as unknown as MetaField;
    const metadata = makeMetadata([makeField("id"), typedField]);

    const doc = {
      _id: "abc-123",
      payload: { when: "2021-06-15T10:30:00.000Z" },
      payload__typemeta: '{"when":"date"}',
    };

    hydrateEntity(doc, metadata);

    const [row] = (defaultHydrateEntity as Mock).mock.calls[0];
    expect(row).toMatchSnapshot();
    expect("payload__typemeta" in row).toBe(false);
  });
});
