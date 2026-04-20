import { describe, expect, test } from "vitest";
import type {
  EntityMetadata,
  MetaField,
  MetaRelation,
} from "../../../entity/types/metadata";
import type { IEntity } from "../../../../interfaces";
import { dehydrateEntity, dehydrateToRow } from "./dehydrate";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeField = (key: string, overrides: Partial<MetaField> = {}): MetaField =>
  ({
    key,
    name: overrides.name ?? key,
    type: overrides.type ?? "string",
    decorator: overrides.decorator ?? "Field",
    computed: overrides.computed ?? null,
    embedded: overrides.embedded ?? null,
    transform: overrides.transform ?? null,
    ...overrides,
  }) as unknown as MetaField;

const makeMetadata = (
  fields: Array<MetaField>,
  overrides: Partial<EntityMetadata> = {},
): EntityMetadata =>
  ({
    entity: { name: "TestEntity" },
    fields,
    primaryKeys: overrides.primaryKeys ?? ["id"],
    relations: overrides.relations ?? [],
    relationIds: overrides.relationIds ?? [],
    relationCounts: overrides.relationCounts ?? [],
    inheritance: overrides.inheritance ?? null,
    ...overrides,
  }) as unknown as EntityMetadata;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("dehydrateEntity", () => {
  test("should dehydrate simple entity with string and number fields", () => {
    const metadata = makeMetadata([
      makeField("id"),
      makeField("name"),
      makeField("age", { type: "integer" }),
    ]);

    const entity = { id: "abc-123", name: "John", age: 30 } as unknown as IEntity;
    expect(dehydrateEntity(entity, metadata)).toMatchSnapshot();
  });

  test("should map PK field to _id", () => {
    const metadata = makeMetadata([makeField("id"), makeField("name")]);

    const entity = { id: "abc-123", name: "John" } as unknown as IEntity;
    const doc = dehydrateEntity(entity, metadata);
    expect(doc._id).toBe("abc-123");
    expect(doc).toMatchSnapshot();
  });

  test("should build compound _id for composite PK", () => {
    const metadata = makeMetadata(
      [makeField("tenantId"), makeField("userId"), makeField("name")],
      { primaryKeys: ["tenantId", "userId"] },
    );

    const entity = {
      tenantId: "t1",
      userId: "u1",
      name: "John",
    } as unknown as IEntity;

    expect(dehydrateEntity(entity, metadata)).toMatchSnapshot();
  });

  test("should keep Date fields as Date objects", () => {
    const metadata = makeMetadata([
      makeField("id"),
      makeField("createdAt", { type: "timestamp" }),
    ]);

    const date = new Date("2024-01-01T00:00:00.000Z");
    const entity = { id: "abc", createdAt: date } as unknown as IEntity;
    const doc = dehydrateEntity(entity, metadata);
    expect(doc.createdAt).toBe(date);
    expect(doc).toMatchSnapshot();
  });

  test("should convert undefined to explicit null for nullable fields", () => {
    const metadata = makeMetadata([
      makeField("id"),
      makeField("nickname", { nullable: true }),
    ]);

    const entity = { id: "abc" } as unknown as IEntity;
    const doc = dehydrateEntity(entity, metadata);
    expect(doc.nickname).toBeNull();
    expect(doc).toMatchSnapshot();
  });

  test("should flatten embedded entity to dot-notation fields", () => {
    const metadata = makeMetadata([
      makeField("id"),
      makeField("address.city", {
        name: "address.city",
        embedded: { parentKey: "address", constructor: () => Object },
      }),
      makeField("address.zip", {
        name: "address.zip",
        embedded: { parentKey: "address", constructor: () => Object },
      }),
    ]);

    const entity = {
      id: "abc",
      address: { city: "Stockholm", zip: "11122" },
    } as unknown as IEntity;

    expect(dehydrateEntity(entity, metadata)).toMatchSnapshot();
  });

  test("should skip computed fields", () => {
    const metadata = makeMetadata([
      makeField("id"),
      makeField("name"),
      makeField("fullName", { computed: "CONCAT(first_name, last_name)" }),
    ]);

    const entity = {
      id: "abc",
      name: "John",
      fullName: "John Doe",
    } as unknown as IEntity;

    const doc = dehydrateEntity(entity, metadata);
    expect(doc.fullName).toBeUndefined();
    expect(doc).toMatchSnapshot();
  });

  test("should include version field", () => {
    const metadata = makeMetadata([
      makeField("id"),
      makeField("version", { decorator: "Version", type: "integer" }),
    ]);

    const entity = { id: "abc", version: 3 } as unknown as IEntity;
    expect(dehydrateEntity(entity, metadata)).toMatchSnapshot();
  });

  test("should stamp discriminator value for inheritance children", () => {
    const metadata = makeMetadata(
      [makeField("id"), makeField("type"), makeField("name")],
      {
        inheritance: {
          strategy: "single-table",
          discriminatorField: "type",
          discriminatorValue: "admin",
          root: class {} as any,
          parent: null,
          children: new Map(),
        },
      },
    );

    const entity = { id: "abc", type: "admin", name: "John" } as unknown as IEntity;
    expect(dehydrateEntity(entity, metadata)).toMatchSnapshot();
  });

  test("should use metadata name for field mapping", () => {
    const metadata = makeMetadata([
      makeField("id"),
      makeField("emailAddress", { name: "email_addr" }),
    ]);

    const entity = { id: "abc", emailAddress: "test@example.com" } as unknown as IEntity;
    const doc = dehydrateEntity(entity, metadata);
    expect(doc.email_addr).toBe("test@example.com");
    expect(doc).toMatchSnapshot();
  });

  test("should apply transform.to() when present", () => {
    const metadata = makeMetadata([
      makeField("id"),
      makeField("code", {
        transform: {
          to: (v: unknown) => (v as string).toUpperCase(),
          from: (v: unknown) => (v as string).toLowerCase(),
        },
      }),
    ]);

    const entity = { id: "abc", code: "hello" } as unknown as IEntity;
    const doc = dehydrateEntity(entity, metadata);
    expect(doc.code).toBe("HELLO");
    expect(doc).toMatchSnapshot();
  });

  test("should handle null embedded parent", () => {
    const metadata = makeMetadata([
      makeField("id"),
      makeField("address.city", {
        name: "address.city",
        embedded: { parentKey: "address", constructor: () => Object },
      }),
    ]);

    const entity = { id: "abc", address: null } as unknown as IEntity;
    const doc = dehydrateEntity(entity, metadata);
    expect(doc["address.city"]).toBeNull();
    expect(doc).toMatchSnapshot();
  });

  test("should handle boolean fields", () => {
    const metadata = makeMetadata([
      makeField("id"),
      makeField("active", { type: "boolean" }),
    ]);

    const entity = { id: "abc", active: true } as unknown as IEntity;
    expect(dehydrateEntity(entity, metadata)).toMatchSnapshot();
  });
});

describe("dehydrateToRow", () => {
  test("should produce a row dict keyed by entity field keys", () => {
    const metadata = makeMetadata([
      makeField("id"),
      makeField("name"),
      makeField("emailAddress", { name: "email_addr" }),
    ]);

    const entity = {
      id: "abc",
      name: "John",
      emailAddress: "test@example.com",
    } as unknown as IEntity;

    const row = dehydrateToRow(entity, metadata);
    // Row uses entity keys, not DB names
    expect(row.emailAddress).toBe("test@example.com");
    expect(row).toMatchSnapshot();
  });

  test("should include discriminator value", () => {
    const metadata = makeMetadata(
      [makeField("id"), makeField("type"), makeField("name")],
      {
        inheritance: {
          strategy: "single-table",
          discriminatorField: "type",
          discriminatorValue: "child",
          root: class {} as any,
          parent: null,
          children: new Map(),
        },
      },
    );

    const entity = { id: "abc", type: "child", name: "Test" } as unknown as IEntity;
    const row = dehydrateToRow(entity, metadata);
    expect(row.type).toBe("child");
    expect(row).toMatchSnapshot();
  });
});
