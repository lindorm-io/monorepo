import { makeField } from "../../__fixtures__/make-field.js";
import type { EntityMetadata, ReadOnlyOperation } from "../types/metadata.js";
import { retainReadonlyFields } from "./retain-readonly-fields.js";
import { describe, expect, test } from "vitest";

const OLD = new Date("2020-01-01T00:00:00.000Z");
const NEW = new Date("2026-01-01T00:00:00.000Z");

const metadata = {
  fields: [
    makeField("createdAt", {
      decorator: "CreateDate",
      name: "created_at",
      readonly: ["update", "upsert"],
    }),
    makeField("updatedAt", {
      decorator: "UpdateDate",
      name: "updated_at",
      readonly: ["update", "upsert"],
    }),
    makeField("version", {
      decorator: "Version",
      name: "version",
      readonly: ["update", "upsert"],
    }),
    makeField("immutable", { name: "immutable", readonly: ["update", "upsert"] }),
    makeField("updateReadonly", { name: "update_readonly", readonly: ["update"] }),
    makeField("upsertReadonly", { name: "upsert_readonly", readonly: ["upsert"] }),
    makeField("name", { name: "name" }),
  ],
} as unknown as EntityMetadata;

const run = (operation: ReadOnlyOperation) => {
  const prepared: Record<string, unknown> = {
    createdAt: NEW,
    updatedAt: NEW,
    version: 1,
    immutable: "new",
    updateReadonly: "new",
    upsertReadonly: "new",
    name: "new",
  };
  const existing = {
    createdAt: OLD,
    updatedAt: OLD,
    version: 5,
    immutable: "keep",
    updateReadonly: "keep",
    upsertReadonly: "keep",
    name: "old",
  };
  retainReadonlyFields(prepared as any, existing, metadata, operation);
  return prepared;
};

describe("retainReadonlyFields", () => {
  describe("operation: upsert", () => {
    test("preserves an immutable CreateDate", () => {
      expect(run("upsert").createdAt).toBe(OLD);
    });

    test("preserves a user field marked @ReadOnly()", () => {
      expect(run("upsert").immutable).toBe("keep");
    });

    test("preserves a user field marked @ReadOnly('upsert')", () => {
      expect(run("upsert").upsertReadonly).toBe("keep");
    });

    test("does NOT preserve a @ReadOnly('update') field — writable by upsert", () => {
      expect(run("upsert").updateReadonly).toBe("new");
    });

    test("does NOT retain UpdateDate — it must advance on the conflict update", () => {
      expect(run("upsert").updatedAt).toBe(NEW);
    });

    test("does NOT retain Version — it is bumped separately on conflict", () => {
      expect(run("upsert").version).toBe(1);
    });

    test("does NOT retain a plain mutable field", () => {
      expect(run("upsert").name).toBe("new");
    });
  });

  describe("operation: update", () => {
    test("preserves an immutable CreateDate", () => {
      expect(run("update").createdAt).toBe(OLD);
    });

    test("preserves a user field marked @ReadOnly()", () => {
      expect(run("update").immutable).toBe("keep");
    });

    test("preserves a user field marked @ReadOnly('update')", () => {
      expect(run("update").updateReadonly).toBe("keep");
    });

    test("does NOT preserve a @ReadOnly('upsert') field — writable by update()", () => {
      expect(run("update").upsertReadonly).toBe("new");
    });

    test("does NOT retain UpdateDate — it must advance on update", () => {
      expect(run("update").updatedAt).toBe(NEW);
    });

    test("does NOT retain Version — it is bumped separately", () => {
      expect(run("update").version).toBe(1);
    });

    test("does NOT retain a plain mutable field", () => {
      expect(run("update").name).toBe("new");
    });
  });
});
