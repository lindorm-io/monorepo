import { makeField } from "../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import { getUpsertSetSkipColumns } from "./get-upsert-set-skip-columns.js";
import { describe, expect, test } from "vitest";

const metadata = {
  entity: { decorator: "Entity", comment: null, name: "widget", namespace: null },
  fields: [
    makeField("id", { type: "uuid", name: "id", readonly: ["update", "upsert"] }),
    makeField("createdAt", {
      type: "timestamp",
      name: "created_at",
      decorator: "CreateDate",
      readonly: ["update", "upsert"],
    }),
    makeField("name", { type: "string", name: "name" }),
    makeField("createdBy", {
      type: "string",
      name: "created_by",
      readonly: ["update", "upsert"],
    }),
    makeField("tenantId", {
      type: "string",
      name: "tenant_id",
      readonly: ["upsert"],
    }),
    makeField("lastSeenBy", {
      type: "string",
      name: "last_seen_by",
      readonly: ["update"],
    }),
  ],
  generated: [],
  relations: [],
  primaryKeys: ["id"],
  inheritance: null,
} as unknown as EntityMetadata;

describe("getUpsertSetSkipColumns", () => {
  const skip = getUpsertSetSkipColumns(metadata);

  test("skips the primary key column", () => {
    expect(skip.has("id")).toBe(true);
  });

  test("skips the CreateDate column", () => {
    expect(skip.has("created_at")).toBe(true);
  });

  test("skips a field readonly on both operations (@ReadOnly())", () => {
    expect(skip.has("created_by")).toBe(true);
  });

  test("skips a field readonly on 'upsert' only (@ReadOnly('upsert'))", () => {
    expect(skip.has("tenant_id")).toBe(true);
  });

  test("does NOT skip a field readonly on 'update' only (@ReadOnly('update'))", () => {
    expect(skip.has("last_seen_by")).toBe(false);
  });

  test("does NOT skip a plain mutable field", () => {
    expect(skip.has("name")).toBe(false);
  });

  test("matches snapshot", () => {
    expect([...getUpsertSetSkipColumns(metadata)].sort()).toMatchSnapshot();
  });
});
