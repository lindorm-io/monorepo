import type { MetaRelation } from "../types/metadata";
import { resolveJoinKeyValue } from "./resolve-join-key-value";
import { describe, expect, test } from "vitest";

const relation = {
  key: "author",
  type: "ManyToOne",
  joinKeys: { authorId: "id" },
} as unknown as MetaRelation;

describe("resolveJoinKeyValue", () => {
  test("should return bare FK value when present", () => {
    const entity = { authorId: "abc-123", author: { id: "xxx" } };
    expect(resolveJoinKeyValue(entity, relation, "authorId", "id")).toBe("abc-123");
  });

  test("should fall back to related entity property", () => {
    const entity = { author: { id: "xyz-789" } };
    expect(resolveJoinKeyValue(entity, relation, "authorId", "id")).toBe("xyz-789");
  });

  test("should return null when related entity has no matching property", () => {
    const entity = { author: { name: "Alice" } };
    expect(resolveJoinKeyValue(entity, relation, "authorId", "id")).toBeNull();
  });

  test("should return null when related entity is null", () => {
    const entity = { author: null };
    expect(resolveJoinKeyValue(entity, relation, "authorId", "id")).toBeNull();
  });

  test("should return null when neither FK nor related entity exist", () => {
    const entity = {};
    expect(resolveJoinKeyValue(entity, relation, "authorId", "id")).toBeNull();
  });

  test("should fall back to related entity when FK is undefined", () => {
    // resolveJoinKeyValue treats undefined as "not set" — falls through to related entity
    const entity = { authorId: undefined, author: { id: "fallback" } };
    expect(resolveJoinKeyValue(entity, relation, "authorId", "id")).toBe("fallback");
  });

  test("should return null FK value without falling back", () => {
    const entity = { authorId: null, author: { id: "should-not-use" } };
    expect(resolveJoinKeyValue(entity, relation, "authorId", "id")).toBeNull();
  });
});
