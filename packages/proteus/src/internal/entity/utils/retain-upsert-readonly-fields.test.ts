import { makeField } from "../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../types/metadata.js";
import { retainUpsertReadonlyFields } from "./retain-upsert-readonly-fields.js";
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
    makeField("enriched", { name: "enriched", readonly: ["upsert"] }),
    makeField("name", { name: "name" }),
  ],
} as unknown as EntityMetadata;

describe("retainUpsertReadonlyFields", () => {
  const run = () => {
    const prepared: Record<string, unknown> = {
      createdAt: NEW,
      updatedAt: NEW,
      version: 1,
      enriched: null,
      name: "new",
    };
    const existing = {
      createdAt: OLD,
      updatedAt: OLD,
      version: 5,
      enriched: "keep",
      name: "old",
    };
    retainUpsertReadonlyFields(prepared as any, existing, metadata);
    return prepared;
  };

  test("preserves an immutable CreateDate", () => {
    expect(run().createdAt).toBe(OLD);
  });

  test("preserves a user field marked @ReadOnly('upsert')", () => {
    expect(run().enriched).toBe("keep");
  });

  test("does NOT retain UpdateDate — it must advance on the conflict update", () => {
    expect(run().updatedAt).toBe(NEW);
  });

  test("does NOT retain Version — it is bumped separately on conflict", () => {
    expect(run().version).toBe(1);
  });

  test("does NOT retain a plain mutable field", () => {
    expect(run().name).toBe("new");
  });
});
