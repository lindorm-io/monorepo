import { describe, expect, test } from "vitest";
import { makeField } from "../../../../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../../../../../entity/types/metadata.js";
import {
  compileUpdate,
  compileUpdateMany,
  compileSoftDelete,
  compileRestore,
  compileDeleteExpired,
} from "../compile-update.js";

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
    makeField("version", { type: "integer", decorator: "Version" }),
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

describe("compileUpdate", () => {
  test("should compile an UPDATE without RETURNING", () => {
    const entity = {
      id: "abc-123",
      name: "Bob",
      version: 2,
      updatedAt: new Date("2024-01-01"),
    };
    const result = compileUpdate(entity, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).not.toContain("RETURNING");
  });

  test("should include version in WHERE for optimistic locking", () => {
    const entity = {
      id: "abc-123",
      name: "Bob",
      version: 2,
      updatedAt: new Date("2024-01-01"),
    };
    const result = compileUpdate(entity, metadata);
    expect(result.text).toContain("`version` = ?");
    // version - 1 in WHERE
    expect(result.params).toContain(1);
  });
});

describe("compileUpdateMany", () => {
  test("should compile an UPDATE ... SET ... WHERE for bulk updates", () => {
    const result = compileUpdateMany({ name: "Alice" }, { name: "Bob" }, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("UPDATE");
    expect(result.text).toContain("SET");
    expect(result.text).toContain("WHERE");
  });

  test("should throw when update object has no valid columns", () => {
    expect(() =>
      compileUpdateMany({ name: "Alice" }, { nonexistent: "value" } as any, metadata),
    ).toThrow(/no valid columns in update object/);
  });

  test("should throw when criteria resolves to empty WHERE", () => {
    expect(() => compileUpdateMany({} as any, { name: "Bob" }, metadata)).toThrow(
      /criteria must not be empty/,
    );
  });
});

describe("compileSoftDelete", () => {
  test("should use NOW(3) for delete date", () => {
    const meta = {
      ...metadata,
      fields: [
        ...metadata.fields,
        makeField("deletedAt", {
          type: "timestamp",
          decorator: "DeleteDate",
          name: "deleted_at",
        }),
      ],
    } as unknown as EntityMetadata;
    const result = compileSoftDelete({ id: "abc-123" } as any, meta);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("NOW(3)");
  });
});

describe("compileRestore", () => {
  test("should set delete date to NULL", () => {
    const meta = {
      ...metadata,
      fields: [
        ...metadata.fields,
        makeField("deletedAt", {
          type: "timestamp",
          decorator: "DeleteDate",
          name: "deleted_at",
        }),
      ],
    } as unknown as EntityMetadata;
    const result = compileRestore({ id: "abc-123" } as any, meta);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("= NULL");
  });
});

describe("compileDeleteExpired", () => {
  test("should use NOW(3) for expiry comparison", () => {
    const meta = {
      ...metadata,
      fields: [
        ...metadata.fields,
        makeField("expiresAt", {
          type: "timestamp",
          decorator: "ExpiryDate",
          name: "expires_at",
        }),
      ],
    } as unknown as EntityMetadata;
    const result = compileDeleteExpired(meta);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("NOW(3)");
  });
});
