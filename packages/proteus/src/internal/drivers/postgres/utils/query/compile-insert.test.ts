import { makeField } from "../../../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { compileInsert, compileInsertBulk } from "./compile-insert.js";
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
  test("should compile a basic insert", () => {
    const entity = { id: "abc-123", name: "Alice", email: "alice@example.com" };
    const result = compileInsert(entity, metadata);
    expect(result).toMatchSnapshot();
  });

  test("should use namespace as schema", () => {
    const entity = { id: "abc-123", name: "Alice", email: "alice@example.com" };
    const result = compileInsert(entity, metadata);
    expect(result.text).toContain('"app"."users"');
  });

  test("should use default namespace when entity has no namespace", () => {
    const meta = {
      ...metadata,
      entity: { ...metadata.entity, namespace: null },
    } as unknown as EntityMetadata;
    const entity = { id: "abc-123", name: "Alice", email: "alice@example.com" };
    const result = compileInsert(entity, meta, "default_ns");
    expect(result.text).toContain('"default_ns"."users"');
  });

  test("should include RETURNING *", () => {
    const entity = { id: "abc-123", name: "Alice", email: "alice@example.com" };
    const result = compileInsert(entity, metadata);
    expect(result.text).toContain("RETURNING *");
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
    expect(result.text).not.toContain('"id"');
    expect(result.params).not.toContain(1);
  });
});

describe("compileInsertBulk", () => {
  test("should compile multi-row insert", () => {
    const entities = [
      { id: "1", name: "Alice", email: "a@b.com" },
      { id: "2", name: "Bob", email: "b@b.com" },
    ];
    const result = compileInsertBulk(entities, metadata);
    expect(result).toMatchSnapshot();
  });

  test("should have correct parameter count", () => {
    const entities = [
      { id: "1", name: "Alice", email: "a@b.com" },
      { id: "2", name: "Bob", email: "b@b.com" },
      { id: "3", name: "Charlie", email: "c@b.com" },
    ];
    const result = compileInsertBulk(entities, metadata);
    expect(result.params).toHaveLength(9);
    expect(result.text).toContain("$9");
  });

  test("should include RETURNING *", () => {
    const entities = [{ id: "1", name: "Alice", email: "a@b.com" }];
    const result = compileInsertBulk(entities, metadata);
    expect(result.text).toContain("RETURNING *");
  });

  test("should throw when entities array is empty", () => {
    expect(() => compileInsertBulk([], metadata)).toThrow(
      /entities array must not be empty/,
    );
  });
});
