import { makeField } from "../../__fixtures__/make-field";
import { validateIndexes } from "./validate-indexes";
import type { MetaIndex } from "../types/metadata";
import { describe, expect, test } from "vitest";

const makeIndex = (
  keys: Array<{ key: string; direction?: "asc" | "desc" }>,
  name: string | null = null,
  unique = false,
): MetaIndex => ({
  keys: keys.map((k) => ({ key: k.key, direction: k.direction ?? "asc", nulls: null })),
  include: null,
  name,
  unique,
  concurrent: false,
  sparse: false,
  where: null,
  using: null,
  with: null,
});

describe("validateIndexes", () => {
  test("should pass with valid index", () => {
    const fields = [makeField("name"), makeField("email")];
    const indexes = [makeIndex([{ key: "name" }])];
    expect(() => validateIndexes("Test", indexes, fields)).not.toThrow();
  });

  test("should pass with empty indexes", () => {
    expect(() => validateIndexes("Test", [], [makeField("id")])).not.toThrow();
  });

  test("should throw when index has no keys", () => {
    const fields = [makeField("name")];
    const indexes = [makeIndex([])];
    expect(() => validateIndexes("Test", indexes, fields)).toThrow(
      "Index fields not found",
    );
  });

  test("should throw on duplicate named index", () => {
    const fields = [makeField("name"), makeField("email")];
    const indexes = [
      makeIndex([{ key: "name" }], "idx_name"),
      makeIndex([{ key: "email" }], "idx_name"),
    ];
    expect(() => validateIndexes("Test", indexes, fields)).toThrow(
      "Duplicate index name",
    );
  });

  test("should not throw on two null-named indexes", () => {
    const fields = [makeField("name"), makeField("email")];
    const indexes = [
      makeIndex([{ key: "name" }], null),
      makeIndex([{ key: "email" }], null),
    ];
    expect(() => validateIndexes("Test", indexes, fields)).not.toThrow();
  });

  test("should throw when index field not found in fields", () => {
    const fields = [makeField("name")];
    const indexes = [makeIndex([{ key: "missing" }])];
    expect(() => validateIndexes("Test", indexes, fields)).toThrow(
      "Index field not found",
    );
  });

  test("should throw on duplicate index keys", () => {
    const fields = [makeField("name")];
    const indexes = [
      makeIndex([{ key: "name" }], null),
      makeIndex([{ key: "name" }], null),
    ];
    expect(() => validateIndexes("Test", indexes, fields)).toThrow(
      "Duplicate index keys",
    );
  });
});
