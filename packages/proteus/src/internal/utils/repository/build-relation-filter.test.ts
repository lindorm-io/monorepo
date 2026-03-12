import type { MetaRelation } from "#internal/entity/types/metadata";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError";
import { buildRelationFilter } from "./build-relation-filter";

const makeRelation = (overrides: Partial<MetaRelation> = {}): MetaRelation =>
  ({
    key: "tags",
    type: "ManyToOne",
    foreignKey: "tagId",
    findKeys: { tagId: "id" },
    joinKeys: null,
    joinTable: null,
    options: {},
    ...overrides,
  }) as unknown as MetaRelation;

describe("buildRelationFilter", () => {
  describe("happy path", () => {
    test("builds filter from findKeys mapping", () => {
      const relation = makeRelation({ findKeys: { tagId: "id" } });
      const entity = { id: "entity-1", name: "test" };
      const result = buildRelationFilter(relation, entity as any);
      expect(result).toMatchSnapshot();
    });

    test("builds filter for multi-key mapping", () => {
      const relation = makeRelation({ findKeys: { tenantId: "tenantId", userId: "id" } });
      const entity = { id: "user-1", tenantId: "tenant-1" };
      const result = buildRelationFilter(relation, entity as any);
      expect(result).toMatchSnapshot();
    });
  });

  describe("null value handling", () => {
    test("coerces undefined entity field to null in filter", () => {
      const relation = makeRelation({ findKeys: { tagId: "id" } });
      const entity = { name: "no-id" };
      const result = buildRelationFilter(relation, entity as any);
      expect(result).toMatchSnapshot();
    });

    test("preserves null entity field as null in filter", () => {
      const relation = makeRelation({ findKeys: { tagId: "id" } });
      const entity = { id: null, name: "test" };
      const result = buildRelationFilter(relation, entity as any);
      expect(result).toMatchSnapshot();
    });

    test("preserves non-null values", () => {
      const relation = makeRelation({ findKeys: { authorId: "id" } });
      const entity = { id: "abc-999" };
      const result = buildRelationFilter(relation, entity as any);
      expect(result).toMatchSnapshot();
    });
  });

  describe("error cases", () => {
    test("throws ProteusRepositoryError when findKeys is null", () => {
      const relation = makeRelation({ findKeys: null });
      const entity = { id: "entity-1" };
      expect(() => buildRelationFilter(relation, entity as any)).toThrow(
        ProteusRepositoryError,
      );
    });

    test("throws with informative message including relation key and type", () => {
      const relation = makeRelation({ key: "author", type: "OneToMany", findKeys: null });
      const entity = { id: "entity-1" };
      expect(() => buildRelationFilter(relation, entity as any)).toThrow(
        'Cannot build relation filter: findKeys is null for relation "author" on "OneToMany"',
      );
    });
  });
});
