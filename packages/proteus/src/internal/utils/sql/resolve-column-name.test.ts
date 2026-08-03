import { describe, expect, test } from "vitest";
import { makeField } from "../../__fixtures__/make-field.js";
import type { MetaRelation } from "../../entity/types/metadata.js";
import { ProteusError } from "../../../errors/index.js";
import { resolveColumnName, resolveColumnNameSafe } from "./resolve-column-name.js";

const fields = [
  makeField("id", { type: "uuid" }),
  makeField("label", { type: "string" }),
  // A declared field under the "snake" strategy: key and column diverge.
  makeField("createdAt", { type: "date", name: "created_at" }),
];

// An owning *ToOne relation whose FK column was auto-projected: no MetaField
// exists for it, and under "snake" the joinKeys key is the physical column.
const snakeRelation = {
  key: "parent",
  type: "ManyToOne",
  joinKeys: { parent_id: "id" },
} as unknown as MetaRelation;

const noneRelation = {
  key: "parent",
  type: "ManyToOne",
  joinKeys: { parentId: "id" },
} as unknown as MetaRelation;

describe("resolveColumnName", () => {
  test("should resolve a declared field by its property key", () => {
    expect(resolveColumnName(fields, "createdAt")).toBe("created_at");
  });

  test("should resolve an auto-projected FK by its property key", () => {
    expect(resolveColumnName(fields, "parentId", [snakeRelation])).toBe("parent_id");
  });

  test("should resolve an auto-projected FK by its physical column name", () => {
    expect(resolveColumnName(fields, "parent_id", [snakeRelation])).toBe("parent_id");
  });

  test("should resolve an auto-projected FK when key and column coincide", () => {
    expect(resolveColumnName(fields, "parentId", [noneRelation])).toBe("parentId");
  });

  test("should let a declared field win over a relation projecting the same column", () => {
    const declared = [...fields, makeField("parentId", { name: "parent_id" })];

    expect(resolveColumnName(declared, "parentId", [snakeRelation])).toBe("parent_id");
  });

  test("should prefer a literal column over another relation's camelCase form", () => {
    const literal = {
      key: "guardian",
      type: "ManyToOne",
      joinKeys: { parentId: "id" },
    } as unknown as MetaRelation;

    expect(resolveColumnName(fields, "parentId", [snakeRelation, literal])).toBe(
      "parentId",
    );
  });

  test("should ignore relations without join keys", () => {
    const inverse = {
      key: "children",
      type: "OneToMany",
      joinKeys: null,
    } as unknown as MetaRelation;

    expect(() => resolveColumnName(fields, "parentId", [inverse])).toThrow(ProteusError);
  });

  test("should throw for an unknown field", () => {
    expect(() => resolveColumnName(fields, "nope", [snakeRelation])).toThrow(
      ProteusError,
    );
  });

  test("should throw when relations are not supplied", () => {
    expect(() => resolveColumnName(fields, "parentId")).toThrow(ProteusError);
  });
});

describe("resolveColumnNameSafe", () => {
  test("should resolve a declared field by its property key", () => {
    expect(resolveColumnNameSafe(fields, "createdAt")).toBe("created_at");
  });

  test("should fall back to the key itself", () => {
    expect(resolveColumnNameSafe(fields, "parent_id")).toBe("parent_id");
  });
});
