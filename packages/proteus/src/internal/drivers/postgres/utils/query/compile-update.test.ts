import { makeField } from "../../../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { ProteusRepositoryError } from "../../../../../errors/ProteusRepositoryError.js";
import { compileUpdate, compileUpdateMany } from "./compile-update.js";
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
    makeField("createdAt", {
      type: "timestamp",
      decorator: "CreateDate",
      name: "created_at",
    }),
    makeField("updatedAt", {
      type: "timestamp",
      decorator: "UpdateDate",
      name: "updated_at",
    }),
  ],
  relations: [],
  primaryKeys: ["id"],
  generated: [],
} as unknown as EntityMetadata;

const entity = {
  id: "abc-123",
  name: "Alice Updated",
  email: "alice-new@example.com",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-06-01"),
};

describe("compileUpdate", () => {
  test("should compile a basic update", () => {
    const result = compileUpdate(entity, metadata);
    expect(result).toMatchSnapshot();
  });

  test("should use table alias t0", () => {
    const result = compileUpdate(entity, metadata);
    expect(result.text).toContain('AS "t0"');
  });

  test("should skip PK in SET clause", () => {
    const result = compileUpdate(entity, metadata);
    const setClause = result.text.split(" WHERE ")[0].split(" SET ")[1];
    expect(setClause).not.toContain('"id"');
  });

  test("should skip CreateDate in SET clause", () => {
    const result = compileUpdate(entity, metadata);
    const setClause = result.text.split(" WHERE ")[0].split(" SET ")[1];
    expect(setClause).not.toContain('"created_at"');
  });

  test("should include PK in WHERE clause", () => {
    const result = compileUpdate(entity, metadata);
    expect(result.text).toContain('"t0"."id" =');
  });

  test("should include RETURNING *", () => {
    const result = compileUpdate(entity, metadata);
    expect(result.text).toContain("RETURNING *");
  });

  test("should add optimistic locking WHERE when Version field exists", () => {
    const versionMetadata = {
      ...metadata,
      fields: [
        ...metadata.fields,
        makeField("version", { type: "integer", decorator: "Version" }),
      ],
    } as unknown as EntityMetadata;

    const versionedEntity = { ...entity, version: 3 };
    const result = compileUpdate(versionedEntity, versionMetadata);
    expect(result).toMatchSnapshot();
  });

  test("should use version - 1 in WHERE for optimistic locking", () => {
    const versionMetadata = {
      ...metadata,
      fields: [
        ...metadata.fields,
        makeField("version", { type: "integer", decorator: "Version" }),
      ],
    } as unknown as EntityMetadata;

    const versionedEntity = { ...entity, version: 5 };
    const result = compileUpdate(versionedEntity, versionMetadata);
    // version in WHERE should be 4 (entity.version - 1)
    expect(result.params).toContain(4);
  });
});

describe("compileUpdateMany", () => {
  test("should compile criteria-based update", () => {
    const result = compileUpdateMany(
      { name: "Alice" } as any,
      { email: "new@example.com" } as any,
      metadata,
    );
    expect(result).toMatchSnapshot();
  });

  test("should use column names in SET clause", () => {
    const result = compileUpdateMany(
      { id: "abc" } as any,
      { email: "new@example.com" } as any,
      metadata,
    );
    expect(result.text).toContain('"email_address"');
  });

  test("should skip unknown fields in update", () => {
    const result = compileUpdateMany(
      { id: "abc" } as any,
      { nonexistent: "value", name: "Bob" } as any,
      metadata,
    );
    expect(result.text).not.toContain("nonexistent");
    expect(result.text).toContain('"name"');
  });

  test("should throw ProteusRepositoryError when criteria is empty", () => {
    // Non-empty update so we pass the first guard, but empty criteria produces no WHERE clause
    expect(() => compileUpdateMany({} as any, { name: "Bob" } as any, metadata)).toThrow(
      ProteusRepositoryError,
    );
  });
});
