import { makeField } from "../../__fixtures__/make-field.js";
import { registerMetadataResolver } from "../metadata/foreign-metadata.js";
import type { EntityMetadata, MetaFieldType, MetaRelation } from "../types/metadata.js";
import { deserialiseForeignKey } from "./deserialise-foreign-key.js";
import { describe, expect, test } from "vitest";

class ForeignTarget {}

/**
 * Builds a relation whose foreign metadata resolves to a single PK field of
 * `foreignType`. Registering a stub resolver against the owning metadata is the
 * same wiring the source does — the registry is a WeakMap, so each relation
 * object is isolated from the others.
 */
const makeRelation = (foreignType: MetaFieldType, pkKey = "id"): MetaRelation => {
  const relation = {
    key: "parent",
    type: "ManyToOne",
    foreignConstructor: () => ForeignTarget,
    joinKeys: { parent_id: pkKey },
  } as unknown as MetaRelation;

  registerMetadataResolver(
    { relations: [relation] } as unknown as EntityMetadata,
    () =>
      ({
        fields: [makeField(pkKey, { type: foreignType })],
      }) as unknown as EntityMetadata,
  );

  return relation;
};

describe("deserialiseForeignKey", () => {
  test("should coerce a bigint FK handed back as a driver string", () => {
    expect(deserialiseForeignKey("1", makeRelation("bigint"), "id")).toBe(BigInt(1));
  });

  test("should pass an already-bigint FK through unchanged", () => {
    expect(deserialiseForeignKey(BigInt(7), makeRelation("bigint"), "id")).toBe(
      BigInt(7),
    );
  });

  test("should coerce an integer FK handed back as a driver string", () => {
    expect(deserialiseForeignKey("42", makeRelation("integer"), "id")).toBe(42);
  });

  test("should coerce a timestamp FK to a Date", () => {
    expect(
      deserialiseForeignKey("2026-08-01T10:00:00.000Z", makeRelation("timestamp"), "id"),
    ).toEqual(new Date("2026-08-01T10:00:00.000Z"));
  });

  test("should leave a uuid FK as a string", () => {
    const value = "8b2a6c1e-0f4d-4b3a-9f21-6d5b2a7c4e10";
    expect(deserialiseForeignKey(value, makeRelation("uuid"), "id")).toBe(value);
  });

  test("should leave a string FK as a string", () => {
    expect(deserialiseForeignKey("abc-123", makeRelation("string"), "id")).toBe(
      "abc-123",
    );
  });

  test("should normalise a null FK to null", () => {
    expect(deserialiseForeignKey(null, makeRelation("bigint"), "id")).toBeNull();
  });

  test("should normalise an undefined FK to null", () => {
    expect(deserialiseForeignKey(undefined, makeRelation("bigint"), "id")).toBeNull();
  });

  test("should return the value verbatim when no foreign PK key is known", () => {
    expect(deserialiseForeignKey("1", makeRelation("bigint"), null)).toBe("1");
  });

  test("should return the value verbatim when the foreign PK field is missing", () => {
    expect(deserialiseForeignKey("1", makeRelation("bigint", "id"), "otherId")).toBe("1");
  });

  test("should return the value verbatim when the relation has no foreign target", () => {
    const relation = { key: "parent", type: "ManyToOne" } as unknown as MetaRelation;
    expect(deserialiseForeignKey("1", relation, "id")).toBe("1");
  });
});
