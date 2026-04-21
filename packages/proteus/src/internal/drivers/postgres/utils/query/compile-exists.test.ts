import { makeField } from "../../../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { compileExists } from "./compile-exists.js";
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
  fields: [makeField("id", { type: "uuid" }), makeField("name", { type: "string" })],
  relations: [],
  primaryKeys: ["id"],
  generated: [],
} as unknown as EntityMetadata;

// ---------------------------------------------------------------------------
// Namespace-override metadata — no namespace on the entity itself
// ---------------------------------------------------------------------------
const noNamespaceMeta = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "users",
    namespace: null,
  },
  fields: [makeField("id", { type: "uuid" }), makeField("name", { type: "string" })],
  relations: [],
  primaryKeys: ["id"],
  generated: [],
} as unknown as EntityMetadata;

// ---------------------------------------------------------------------------
// Soft-delete metadata
// ---------------------------------------------------------------------------
const softDeleteMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "invoices",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("total", { type: "float" }),
    makeField("deletedAt", {
      type: "timestamp",
      name: "deleted_at",
      decorator: "DeleteDate",
      nullable: true,
    }),
  ],
  relations: [],
  primaryKeys: ["id"],
  generated: [],
} as unknown as EntityMetadata;

// ---------------------------------------------------------------------------
// Versioned metadata
// ---------------------------------------------------------------------------
const versionedMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "prices",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("value", { type: "float" }),
    makeField("versionStartDate", {
      type: "timestamp",
      name: "version_start_date",
      decorator: "VersionStartDate",
    }),
    makeField("versionEndDate", {
      type: "timestamp",
      name: "version_end_date",
      decorator: "VersionEndDate",
      nullable: true,
    }),
  ],
  relations: [],
  primaryKeys: ["id"],
  generated: [],
} as unknown as EntityMetadata;

describe("compileExists", () => {
  test("should compile exists query", () => {
    const result = compileExists({ id: "abc-123" } as any, metadata);
    expect(result).toMatchSnapshot();
  });

  test("should use SELECT EXISTS pattern", () => {
    const result = compileExists({ id: "abc-123" } as any, metadata);
    expect(result.text).toMatch(/^SELECT EXISTS\(SELECT 1 FROM/);
  });

  test("should include LIMIT 1", () => {
    const result = compileExists({ id: "abc-123" } as any, metadata);
    expect(result.text).toContain("LIMIT 1");
  });

  test("should compile with multiple criteria", () => {
    const result = compileExists({ name: "Alice", id: "abc" } as any, metadata);
    expect(result).toMatchSnapshot();
  });

  describe("namespace override", () => {
    test("uses explicit namespace when metadata.namespace is null", () => {
      const result = compileExists({ id: "abc-123" } as any, noNamespaceMeta, "public");
      expect(result).toMatchSnapshot();
    });

    test("schema-qualifies the table name with the explicit namespace", () => {
      const result = compileExists({ id: "abc-123" } as any, noNamespaceMeta, "public");
      expect(result.text).toContain('"public"."users"');
    });

    test("metadata.namespace takes precedence over explicit namespace override", () => {
      // metadata.namespace = "app"; override = "public" — "app" wins
      const result = compileExists({ id: "abc-123" } as any, metadata, "public");
      expect(result.text).toContain('"app"."users"');
      expect(result.text).not.toContain('"public"');
    });

    test("unqualified table name when both metadata.namespace is null and no override given", () => {
      const result = compileExists({ id: "abc-123" } as any, noNamespaceMeta);
      expect(result.text).not.toContain('"public"');
      expect(result.text).not.toContain('"app"');
      expect(result.text).toContain('"users"');
    });
  });

  describe("soft-delete entity", () => {
    test("includes deleted_at IS NULL system filter", () => {
      const result = compileExists({ id: "abc-123" } as any, softDeleteMetadata);
      expect(result).toMatchSnapshot();
    });

    test("text contains deleted_at IS NULL condition", () => {
      const result = compileExists({ id: "abc-123" } as any, softDeleteMetadata);
      expect(result.text).toContain('"deleted_at" IS NULL');
    });

    test("no extra params are added for the soft-delete filter", () => {
      // soft-delete filter is parameterless — only the criteria param should exist
      const result = compileExists({ id: "abc-123" } as any, softDeleteMetadata);
      expect(result.params).toEqual(["abc-123"]);
    });
  });

  describe("versioned entity", () => {
    test("includes version_end_date IS NULL system filter", () => {
      const result = compileExists({ id: "abc-123" } as any, versionedMetadata);
      expect(result).toMatchSnapshot();
    });

    test("text contains version_end_date IS NULL condition", () => {
      const result = compileExists({ id: "abc-123" } as any, versionedMetadata);
      expect(result.text).toContain('"version_end_date" IS NULL');
    });

    test("no extra params are added for the version filter", () => {
      // version filter IS NULL is parameterless — only the criteria param should exist
      const result = compileExists({ id: "abc-123" } as any, versionedMetadata);
      expect(result.params).toEqual(["abc-123"]);
    });
  });
});
