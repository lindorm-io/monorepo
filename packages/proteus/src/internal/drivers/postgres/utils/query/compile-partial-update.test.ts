import { makeField } from "../../../../__fixtures__/make-field";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import { compilePartialUpdate } from "./compile-partial-update";

const metadata = {
  entity: { name: "users", namespace: "app" },
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
  ],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

describe("compilePartialUpdate", () => {
  test("should compile UPDATE with only changed columns", () => {
    const entity = {
      id: "abc-123",
      name: "Bob",
      version: 3,
      updatedAt: new Date("2024-06-01"),
    } as any;
    const changed = { name: "Bob" };
    const result = compilePartialUpdate(entity, metadata, changed);
    expect(result).toMatchSnapshot();
  });

  test("should include Version and UpdateDate in SET clause", () => {
    const entity = {
      id: "abc-123",
      name: "Bob",
      version: 3,
      updatedAt: new Date("2024-06-01"),
    } as any;
    const changed = { name: "Bob" };
    const result = compilePartialUpdate(entity, metadata, changed);
    expect(result.text).toContain('"version"');
    expect(result.text).toContain('"updated_at"');
  });

  test("should include PK and old version in WHERE clause", () => {
    const entity = {
      id: "abc-123",
      name: "Bob",
      version: 3,
      updatedAt: new Date("2024-06-01"),
    } as any;
    const changed = { name: "Bob" };
    const result = compilePartialUpdate(entity, metadata, changed);
    // WHERE should have pk = $N AND version = $N (version - 1 = 2)
    expect(result.params).toContain("abc-123");
    expect(result.params).toContain(2); // old version = current - 1
  });

  test("should use namespace as schema", () => {
    const entity = {
      id: "abc-123",
      name: "Bob",
      version: 2,
      updatedAt: new Date(),
    } as any;
    const changed = { name: "Bob" };
    const result = compilePartialUpdate(entity, metadata, changed);
    expect(result.text).toContain('"app"."users"');
  });

  test("should use parameter namespace as fallback when metadata has none", () => {
    const metaNoNs = {
      ...metadata,
      entity: { ...metadata.entity, namespace: null },
    } as unknown as EntityMetadata;
    const entity = {
      id: "abc-123",
      name: "Bob",
      version: 2,
      updatedAt: new Date(),
    } as any;
    const changed = { name: "Bob" };
    const result = compilePartialUpdate(entity, metaNoNs, changed, "custom");
    expect(result.text).toContain('"custom"."users"');
  });

  test("should handle multiple changed columns", () => {
    const entity = {
      id: "abc-123",
      name: "Bob",
      email: "bob@test.com",
      version: 2,
      updatedAt: new Date(),
    } as any;
    const changed = { name: "Bob", email_address: "bob@test.com" };
    const result = compilePartialUpdate(entity, metadata, changed);
    expect(result.text).toContain('"name"');
    expect(result.text).toContain('"email_address"');
  });

  describe("Version/UpdateDate deduplication — no double-write", () => {
    test("version column in changed dict appears exactly once in SET clause", () => {
      const entity = {
        id: "abc-123",
        name: "Bob",
        version: 4,
        updatedAt: new Date("2024-06-01"),
      } as any;
      const changed = { name: "Bob", version: 4 };
      const result = compilePartialUpdate(entity, metadata, changed);
      expect(result).toMatchSnapshot();
      const setClause = result.text.split("SET ")[1].split(" WHERE")[0];
      const versionMatches = setClause.match(/"version"/g) ?? [];
      expect(versionMatches.length).toBe(1);
    });

    test("updated_at column in changed dict appears exactly once in SET clause", () => {
      const updatedAt = new Date("2024-06-01");
      const entity = {
        id: "abc-123",
        name: "Bob",
        version: 4,
        updatedAt,
      } as any;
      const changed = { name: "Bob", updated_at: updatedAt };
      const result = compilePartialUpdate(entity, metadata, changed);
      expect(result).toMatchSnapshot();
      const setClause = result.text.split("SET ")[1].split(" WHERE")[0];
      const updateDateMatches = setClause.match(/"updated_at"/g) ?? [];
      expect(updateDateMatches.length).toBe(1);
    });

    test("params count is correct without duplicates", () => {
      const entity = {
        id: "abc-123",
        name: "Bob",
        version: 5,
        updatedAt: new Date("2024-06-01"),
      } as any;
      // changed has name + version; UpdateDate is NOT in changed so it gets appended
      const changed = { name: "Bob", version: 5 };
      const result = compilePartialUpdate(entity, metadata, changed);
      expect(result).toMatchSnapshot();
      // params: name($1), version_from_changed($2), updatedAt_appended($3), id($4), old-version($5)
      expect(result.params).toHaveLength(5);
    });

    test("version and updatedAt both in changed — no extra params", () => {
      const updatedAt = new Date("2024-07-01");
      const entity = {
        id: "id-999",
        name: "Charlie",
        version: 10,
        updatedAt,
      } as any;
      const changed = { name: "Charlie", version: 10, updated_at: updatedAt };
      const result = compilePartialUpdate(entity, metadata, changed);
      expect(result).toMatchSnapshot();
      // params: name($1), version($2), updated_at($3), id($4), old-version($5)
      expect(result.params).toHaveLength(5);
    });
  });

  test("should handle entity without version field", () => {
    const metaNoVersion = {
      ...metadata,
      fields: metadata.fields.filter((f: any) => f.decorator !== "Version"),
    } as unknown as EntityMetadata;

    const entity = { id: "abc-123", name: "Bob", updatedAt: new Date() } as any;
    const changed = { name: "Bob" };
    const result = compilePartialUpdate(entity, metaNoVersion, changed);
    expect(result.text).not.toContain('"version"');
    expect(result.text).toContain("RETURNING *");
  });
});
