import { makeField } from "../../../../../__fixtures__/make-field";
import type { EntityMetadata } from "../../../../../entity/types/metadata";
import { compileUpsert } from "../compile-upsert";
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
    makeField("version", { type: "integer", decorator: "Version" }),
    makeField("updatedAt", {
      type: "timestamp",
      decorator: "UpdateDate",
      name: "updated_at",
    }),
    makeField("createdAt", {
      type: "timestamp",
      decorator: "CreateDate",
      name: "created_at",
    }),
  ],
  relations: [],
  primaryKeys: ["id"],
  generated: [],
} as unknown as EntityMetadata;

describe("compileUpsert", () => {
  test("should compile MySQL ON DUPLICATE KEY UPDATE with AS _new", () => {
    const entity = {
      id: "abc-123",
      name: "Alice",
      email: "alice@example.com",
      version: 1,
      updatedAt: new Date("2024-01-01"),
      createdAt: new Date("2024-01-01"),
    };
    const result = compileUpsert(entity, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("AS `_new`");
    expect(result.text).toContain("ON DUPLICATE KEY UPDATE");
    expect(result.text).not.toContain("RETURNING");
    expect(result.text).not.toContain("ON CONFLICT");
  });

  test("should use _new alias for mutable columns", () => {
    const entity = {
      id: "abc-123",
      name: "Alice",
      email: "alice@example.com",
      version: 1,
      updatedAt: new Date("2024-01-01"),
      createdAt: new Date("2024-01-01"),
    };
    const result = compileUpsert(entity, metadata);
    expect(result.text).toContain("`_new`.`name`");
    expect(result.text).toContain("`_new`.`email_address`");
  });

  test("should increment version on conflict", () => {
    const entity = {
      id: "abc-123",
      name: "Alice",
      email: "alice@example.com",
      version: 1,
      updatedAt: new Date("2024-01-01"),
      createdAt: new Date("2024-01-01"),
    };
    const result = compileUpsert(entity, metadata);
    expect(result.text).toContain("`version` = `app`.`users`.`version` + 1");
  });

  test("should use NOW(3) for update date on conflict", () => {
    const entity = {
      id: "abc-123",
      name: "Alice",
      email: "alice@example.com",
      version: 1,
      updatedAt: new Date("2024-01-01"),
      createdAt: new Date("2024-01-01"),
    };
    const result = compileUpsert(entity, metadata);
    expect(result.text).toContain("`updated_at` = NOW(3)");
  });

  test("should not include PK or CreateDate in SET clause", () => {
    const entity = {
      id: "abc-123",
      name: "Alice",
      email: "alice@example.com",
      version: 1,
      updatedAt: new Date("2024-01-01"),
      createdAt: new Date("2024-01-01"),
    };
    const result = compileUpsert(entity, metadata);
    // id should not appear in SET
    const setClause = result.text.split("ON DUPLICATE KEY UPDATE")[1];
    expect(setClause).not.toContain("`id` =");
    expect(setClause).not.toContain("`created_at` =");
  });

  test("should throw for joined inheritance entities", () => {
    const meta = {
      ...metadata,
      inheritance: {
        strategy: "joined",
        discriminatorValue: "car",
        discriminatorField: "type",
        root: class {},
        children: new Map(),
      },
    } as unknown as EntityMetadata;
    const entity = {
      id: "abc-123",
      name: "Alice",
      email: "alice@example.com",
      version: 1,
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    expect(() => compileUpsert(entity, meta)).toThrow(
      /not supported for joined inheritance/,
    );
  });
});
