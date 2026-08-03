import type {
  EntityMetadata,
  MetaField,
  MetaRelation,
} from "../../entity/types/metadata.js";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError.js";
import { buildRelationFilter } from "./build-relation-filter.js";
import { describe, expect, test } from "vitest";

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

const makeMetadata = (fields: Array<[string, string]> = []): EntityMetadata =>
  ({
    fields: fields.map(([key, name]) => ({ key, name })) as Array<MetaField>,
  }) as EntityMetadata;

const LOCAL = makeMetadata([["id", "id"]]);
const FOREIGN = makeMetadata([]);

describe("buildRelationFilter", () => {
  describe("happy path", () => {
    test("builds filter from findKeys mapping", () => {
      const relation = makeRelation({ findKeys: { tagId: "id" } });
      const entity = { id: "entity-1", name: "test" };
      const result = buildRelationFilter(relation, entity as any, LOCAL, FOREIGN);
      expect(result).toMatchSnapshot();
    });

    test("builds filter for multi-key mapping", () => {
      const relation = makeRelation({ findKeys: { tenantId: "tenantId", userId: "id" } });
      const entity = { id: "user-1", tenantId: "tenant-1" };
      const result = buildRelationFilter(relation, entity as any, LOCAL, FOREIGN);
      expect(result).toMatchSnapshot();
    });

    test("keys the filter by the foreign PROPERTY key, not the renamed column", () => {
      // Under the snake strategy `findKeys` names the physical column
      // (`author_id`), which is not what the entity — or a memory/redis row —
      // is keyed by.
      const relation = makeRelation({ findKeys: { author_id: "user_id" } });
      const local = makeMetadata([["userId", "user_id"]]);
      const foreign = makeMetadata([["authorId", "author_id"]]);
      const entity = { userId: "user-1" };

      const result = buildRelationFilter(relation, entity as any, local, foreign);

      expect(result).toEqual({ authorId: "user-1" });
    });

    test("resolves an auto-projected FK column with no declared field", () => {
      const relation = makeRelation({ findKeys: { parent_id: "id" } });
      const entity = { id: "parent-1" };

      const result = buildRelationFilter(relation, entity as any, LOCAL, FOREIGN);

      expect(result).toEqual({ parentId: "parent-1" });
    });
  });

  describe("null value handling", () => {
    test("coerces undefined entity field to null in filter", () => {
      const relation = makeRelation({ findKeys: { tagId: "id" } });
      const entity = { name: "no-id" };
      const result = buildRelationFilter(relation, entity as any, LOCAL, FOREIGN);
      expect(result).toMatchSnapshot();
    });

    test("preserves null entity field as null in filter", () => {
      const relation = makeRelation({ findKeys: { tagId: "id" } });
      const entity = { id: null, name: "test" };
      const result = buildRelationFilter(relation, entity as any, LOCAL, FOREIGN);
      expect(result).toMatchSnapshot();
    });

    test("preserves non-null values", () => {
      const relation = makeRelation({ findKeys: { authorId: "id" } });
      const entity = { id: "abc-999" };
      const result = buildRelationFilter(relation, entity as any, LOCAL, FOREIGN);
      expect(result).toMatchSnapshot();
    });
  });

  describe("error cases", () => {
    test("throws ProteusRepositoryError when findKeys is null", () => {
      const relation = makeRelation({ findKeys: null });
      const entity = { id: "entity-1" };
      expect(() => buildRelationFilter(relation, entity as any, LOCAL, FOREIGN)).toThrow(
        ProteusRepositoryError,
      );
    });

    test("throws with informative message including relation key and type", () => {
      const relation = makeRelation({ key: "author", type: "OneToMany", findKeys: null });
      const entity = { id: "entity-1" };
      expect(() => buildRelationFilter(relation, entity as any, LOCAL, FOREIGN)).toThrow(
        'Cannot build relation filter: findKeys is null for relation "author" on "OneToMany"',
      );
    });
  });
});
