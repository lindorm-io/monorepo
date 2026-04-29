import { makeField } from "../../../../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../../../../../entity/types/metadata.js";
import { compileInsert, compileInsertBulk } from "../compile-insert.js";
import { describe, expect, test } from "vitest";

const metadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "users",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("email", { type: "string", name: "email_address" }),
  ],
  relations: [],
  primaryKeys: ["id"],
  generated: [],
} as unknown as EntityMetadata;

describe("compileInsert", () => {
  test("should compile a basic insert without RETURNING", () => {
    const entity = { id: "abc-123", name: "Alice", email: "alice@example.com" };
    const result = compileInsert(entity, metadata);
    expect(result).toMatchSnapshot();
    // MySQL has NO RETURNING
    expect(result.text).not.toContain("RETURNING");
  });

  test("should use namespace as database qualifier", () => {
    const entity = { id: "abc-123", name: "Alice", email: "alice@example.com" };
    const result = compileInsert(entity, metadata);
    expect(result.text).toContain("`app`.`users`");
  });

  test("should use default namespace when entity has no namespace", () => {
    const meta = {
      ...metadata,
      entity: { ...metadata.entity, namespace: null },
    } as unknown as EntityMetadata;
    const entity = { id: "abc-123", name: "Alice", email: "alice@example.com" };
    const result = compileInsert(entity, meta, "default_ns");
    expect(result.text).toContain("`default_ns`.`users`");
  });

  test("should use ? placeholders", () => {
    const entity = { id: "abc-123", name: "Alice", email: "alice@example.com" };
    const result = compileInsert(entity, metadata);
    expect(result.text).toContain("?, ?, ?");
  });

  test("should skip IDENTITY generated fields", () => {
    const meta = {
      ...metadata,
      generated: [
        { key: "id", strategy: "increment", length: null, max: null, min: null },
      ],
    } as unknown as EntityMetadata;
    const entity = { id: 1, name: "Alice", email: "alice@example.com" };
    const result = compileInsert(entity, meta);
    expect(result.text).not.toContain("`id`");
    expect(result.params).not.toContain(1);
  });

  test("should apply transform.to() on field values", () => {
    const meta = {
      ...metadata,
      fields: [
        makeField("id", { type: "uuid" }),
        makeField("name", {
          type: "string",
          transform: { to: (v: any) => v.toUpperCase(), from: (v: any) => v },
        }),
        makeField("email", { type: "string", name: "email_address" }),
      ],
    } as unknown as EntityMetadata;
    const entity = { id: "abc-123", name: "alice", email: "alice@example.com" };
    const result = compileInsert(entity, meta);
    expect(result).toMatchSnapshot();
    // The name value should be transformed to uppercase
    expect(result.params).toContain("ALICE");
  });

  test("should include discriminator column when entity has inheritance root metadata", () => {
    // Root entities (discriminatorValue = null) with children get a discriminator column
    // via applyDiscriminatorColumn. We test by providing a discriminator field with an
    // explicit value on the entity.
    const meta = {
      ...metadata,
      inheritance: {
        strategy: "single-table",
        discriminatorField: "__discriminator",
        discriminatorValue: null, // root entity
        root: null,
        children: new Map([["admin", class {} as any]]),
      },
      fields: [
        makeField("id", { type: "uuid" }),
        makeField("name", { type: "string" }),
        makeField("email", { type: "string", name: "email_address" }),
        makeField("__discriminator", { type: "string", name: "__discriminator" }),
      ],
    } as unknown as EntityMetadata;
    const entity = {
      id: "abc-123",
      name: "Alice",
      email: "alice@example.com",
      __discriminator: "base",
    };
    const result = compileInsert(entity, meta);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("`__discriminator`");
  });
});

describe("compileInsertBulk", () => {
  test("should compile multi-row insert without RETURNING", () => {
    const entities = [
      { id: "1", name: "Alice", email: "a@b.com" },
      { id: "2", name: "Bob", email: "b@b.com" },
    ];
    const result = compileInsertBulk(entities, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).not.toContain("RETURNING");
  });

  test("should have correct parameter count", () => {
    const entities = [
      { id: "1", name: "Alice", email: "a@b.com" },
      { id: "2", name: "Bob", email: "b@b.com" },
      { id: "3", name: "Charlie", email: "c@b.com" },
    ];
    const result = compileInsertBulk(entities, metadata);
    expect(result.params).toHaveLength(9);
  });

  test("should throw when entities array is empty", () => {
    expect(() => compileInsertBulk([], metadata)).toThrow(
      /entities array must not be empty/,
    );
  });
});
