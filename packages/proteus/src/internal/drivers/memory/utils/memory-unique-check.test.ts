import type { EntityMetadata } from "../../../entity/types/metadata.js";
import type { MemoryTable } from "../types/memory-store.js";
import { MemoryDuplicateKeyError } from "../errors/MemoryDuplicateKeyError.js";
import { checkUniqueConstraints } from "./memory-unique-check.js";
import { describe, expect, test } from "vitest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeUnique = (keys: string[]): EntityMetadata["uniques"][number] => ({
  keys,
  name: null,
});

const makeMetadata = (uniques: EntityMetadata["uniques"]): EntityMetadata =>
  ({
    entity: { name: "TestEntity" },
    uniques,
  }) as unknown as EntityMetadata;

const makeTable = (rows: Array<[string, Record<string, unknown>]>): MemoryTable =>
  new Map(rows);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("checkUniqueConstraints", () => {
  describe("no unique constraints defined", () => {
    test("passes with empty unique list", () => {
      const table = makeTable([["pk1", { email: "a@b.com" }]]);
      const metadata = makeMetadata([]);
      const row = { email: "a@b.com" };

      expect(() => checkUniqueConstraints(table, row, metadata, null)).not.toThrow();
    });
  });

  describe("single-column unique constraint", () => {
    test("passes when new row is unique", () => {
      const table = makeTable([["pk1", { email: "a@b.com" }]]);
      const metadata = makeMetadata([makeUnique(["email"])]);
      const row = { email: "c@d.com" };

      expect(() => checkUniqueConstraints(table, row, metadata, null)).not.toThrow();
    });

    test("throws MemoryDuplicateKeyError when duplicate value found", () => {
      const table = makeTable([["pk1", { email: "a@b.com" }]]);
      const metadata = makeMetadata([makeUnique(["email"])]);
      const row = { email: "a@b.com" };

      expect(() => checkUniqueConstraints(table, row, metadata, null)).toThrow(
        MemoryDuplicateKeyError,
      );
    });

    test("duplicate key error message contains entity name and column", () => {
      const table = makeTable([["pk1", { email: "dup@test.com" }]]);
      const metadata = makeMetadata([makeUnique(["email"])]);
      const row = { email: "dup@test.com" };

      expect(() => checkUniqueConstraints(table, row, metadata, null)).toThrow(
        /TestEntity/,
      );
    });
  });

  describe("excludePk (UPDATE path)", () => {
    test("does not throw when duplicate is the same row being updated", () => {
      const table = makeTable([["pk1", { email: "a@b.com" }]]);
      const metadata = makeMetadata([makeUnique(["email"])]);
      const row = { email: "a@b.com" };

      expect(() => checkUniqueConstraints(table, row, metadata, "pk1")).not.toThrow();
    });

    test("throws when duplicate is a different row", () => {
      const table = makeTable([
        ["pk1", { email: "a@b.com" }],
        ["pk2", { email: "b@c.com" }],
      ]);
      const metadata = makeMetadata([makeUnique(["email"])]);
      const row = { email: "a@b.com" };

      expect(() => checkUniqueConstraints(table, row, metadata, "pk2")).toThrow(
        MemoryDuplicateKeyError,
      );
    });
  });

  describe("NULL semantics (NULL != NULL)", () => {
    test("skips constraint when all unique columns are null in new row", () => {
      const table = makeTable([["pk1", { email: null }]]);
      const metadata = makeMetadata([makeUnique(["email"])]);
      const row = { email: null };

      expect(() => checkUniqueConstraints(table, row, metadata, null)).not.toThrow();
    });

    test("skips comparison when existing row column is null", () => {
      const table = makeTable([["pk1", { email: null }]]);
      const metadata = makeMetadata([makeUnique(["email"])]);
      const row = { email: "x@y.com" };

      expect(() => checkUniqueConstraints(table, row, metadata, null)).not.toThrow();
    });

    test("skips comparison when new row column is null but existing is not", () => {
      const table = makeTable([["pk1", { email: "a@b.com" }]]);
      const metadata = makeMetadata([makeUnique(["email"])]);
      const row = { email: null };

      expect(() => checkUniqueConstraints(table, row, metadata, null)).not.toThrow();
    });
  });

  describe("composite unique constraint", () => {
    test("passes when only one column matches", () => {
      const table = makeTable([["pk1", { tenantId: "t1", username: "alice" }]]);
      const metadata = makeMetadata([makeUnique(["tenantId", "username"])]);
      const row = { tenantId: "t1", username: "bob" };

      expect(() => checkUniqueConstraints(table, row, metadata, null)).not.toThrow();
    });

    test("throws when all columns of composite key match", () => {
      const table = makeTable([["pk1", { tenantId: "t1", username: "alice" }]]);
      const metadata = makeMetadata([makeUnique(["tenantId", "username"])]);
      const row = { tenantId: "t1", username: "alice" };

      expect(() => checkUniqueConstraints(table, row, metadata, null)).toThrow(
        MemoryDuplicateKeyError,
      );
    });

    test("passes when composite key matches but one part is null", () => {
      const table = makeTable([["pk1", { tenantId: "t1", username: null }]]);
      const metadata = makeMetadata([makeUnique(["tenantId", "username"])]);
      const row = { tenantId: "t1", username: null };

      expect(() => checkUniqueConstraints(table, row, metadata, null)).not.toThrow();
    });
  });

  describe("multiple unique constraints", () => {
    test("checks all constraints independently", () => {
      const table = makeTable([["pk1", { email: "a@b.com", phone: "555" }]]);
      const metadata = makeMetadata([makeUnique(["email"]), makeUnique(["phone"])]);
      const row = { email: "x@y.com", phone: "555" };

      expect(() => checkUniqueConstraints(table, row, metadata, null)).toThrow(
        MemoryDuplicateKeyError,
      );
    });

    test("passes when no constraint is violated", () => {
      const table = makeTable([["pk1", { email: "a@b.com", phone: "555" }]]);
      const metadata = makeMetadata([makeUnique(["email"]), makeUnique(["phone"])]);
      const row = { email: "z@z.com", phone: "999" };

      expect(() => checkUniqueConstraints(table, row, metadata, null)).not.toThrow();
    });
  });
});
