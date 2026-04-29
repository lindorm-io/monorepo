import { defaultRelationFilter } from "./default-relation-filter.js";
import type { MetaRelation } from "../types/metadata.js";
import { describe, expect, test } from "vitest";

const makeRelation = (overrides: Partial<MetaRelation> = {}): MetaRelation =>
  ({
    key: "profile",
    foreignConstructor: () => class Profile {},
    foreignKey: "user",
    findKeys: { userId: "id" },
    joinKeys: null,
    joinTable: null,
    options: {
      loading: { single: "ignore", multiple: "ignore" },
      nullable: false,
      onDestroy: "ignore",
      onInsert: "ignore",
      onOrphan: "ignore",
      onSoftDestroy: "ignore",
      onUpdate: "ignore",
      strategy: null,
    },
    type: "OneToOne",
    ...overrides,
  }) as MetaRelation;

describe("defaultRelationFilter", () => {
  test("should build filter from findKeys and entity values", () => {
    const relation = makeRelation({ findKeys: { userId: "id" } });
    const entity = { id: "abc-123", name: "Alice" } as any;
    expect(defaultRelationFilter(relation, entity)).toMatchSnapshot();
  });

  test("should set null for missing entity key", () => {
    const relation = makeRelation({ findKeys: { userId: "id" } });
    const entity = { name: "Alice" } as any;
    const result = defaultRelationFilter(relation, entity);
    expect(result).toMatchSnapshot();
  });

  test("should handle multiple findKeys", () => {
    const relation = makeRelation({ findKeys: { tenantId: "tenantId", userId: "id" } });
    const entity = { id: "user-1", tenantId: "tenant-1" } as any;
    expect(defaultRelationFilter(relation, entity)).toMatchSnapshot();
  });

  test("should throw when findKeys is null", () => {
    const relation = makeRelation({ findKeys: null });
    const entity = { id: "abc-123" } as any;
    expect(() => defaultRelationFilter(relation, entity)).toThrow(
      "Cannot build relation filter without findKeys",
    );
  });
});
