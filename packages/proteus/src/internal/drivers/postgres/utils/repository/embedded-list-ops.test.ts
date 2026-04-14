/**
 * Tests for embedded-list-ops.ts
 * Covers: insertEmbeddedListRows, deleteEmbeddedListRows, loadEmbeddedListRows,
 *         loadEmbeddedListRowsBatch, saveEmbeddedListRows
 */

import type { MetaEmbeddedList } from "#internal/entity/types/metadata";
import type { PostgresQueryClient } from "../../types/postgres-query-client";
import { makeField } from "../../../../__fixtures__/make-field";
import {
  deleteEmbeddedListRows,
  insertEmbeddedListRows,
  loadEmbeddedListRows,
  loadEmbeddedListRowsBatch,
  saveEmbeddedListRows,
} from "./embedded-list-ops";

jest.mock("../quote-identifier", () => ({
  quoteIdentifier: jest.fn((name: string) => `"${name}"`),
  quoteQualifiedName: jest.fn((namespace: string | null, name: string) =>
    namespace ? `"${namespace}"."${name}"` : `"${name}"`,
  ),
}));

jest.mock("#internal/entity/utils/deserialise", () => ({
  deserialise: jest.fn((value: unknown) => value),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

class TagEmbeddable {
  label: string = "";
  score: number = 0;
}

const primitiveEmbeddedList: MetaEmbeddedList = {
  key: "tags",
  tableName: "article_tags",
  parentFkColumn: "article_id",
  parentPkColumn: "id",
  elementType: "string",
  elementFields: null,
  elementConstructor: null,
  loading: { single: "eager", multiple: "lazy" },
};

const embeddableEmbeddedList: MetaEmbeddedList = {
  key: "tagObjects",
  tableName: "article_tag_objects",
  parentFkColumn: "article_id",
  parentPkColumn: "id",
  elementType: null,
  elementFields: [
    makeField("label", { type: "string", name: "label" }),
    makeField("score", { type: "integer", name: "score" }),
  ],
  elementConstructor: () => TagEmbeddable as any,
  loading: { single: "eager", multiple: "lazy" },
};

// ─── Mock Client ──────────────────────────────────────────────────────────────

const createMockClient = (
  rows: Array<Record<string, unknown>> = [],
): {
  client: PostgresQueryClient;
  queries: Array<{ sql: string; params?: Array<unknown> }>;
} => {
  const queries: Array<{ sql: string; params?: Array<unknown> }> = [];
  const client = {
    query: jest.fn(async (sql: string, params?: Array<unknown>) => {
      queries.push({ sql, params });
      return { rows, rowCount: rows.length };
    }),
  } as unknown as PostgresQueryClient;
  return { client, queries };
};

// ─── loadEmbeddedListRowsBatch ────────────────────────────────────────────────

describe("loadEmbeddedListRowsBatch", () => {
  describe("SQL generation", () => {
    test("uses WHERE fk = ANY($1) with array parameter", async () => {
      const entities = [{ id: "e1" }, { id: "e2" }];
      const { client, queries } = createMockClient([]);

      await loadEmbeddedListRowsBatch(
        entities as any,
        primitiveEmbeddedList,
        client,
        null,
      );

      expect(queries).toHaveLength(1);
      expect(queries[0].sql).toContain("ANY($1)");
      expect(queries[0].params).toEqual([["e1", "e2"]]);
    });

    test("passes all pk values as a single array parameter", async () => {
      const entities = [{ id: "a1" }, { id: "b2" }, { id: "c3" }];
      const { client, queries } = createMockClient([]);

      await loadEmbeddedListRowsBatch(
        entities as any,
        primitiveEmbeddedList,
        client,
        null,
      );

      expect(queries[0].params).toMatchSnapshot();
    });

    test("uses qualified table name with namespace", async () => {
      const entities = [{ id: "e1" }];
      const { client, queries } = createMockClient([]);

      await loadEmbeddedListRowsBatch(
        entities as any,
        primitiveEmbeddedList,
        client,
        "myschema",
      );

      expect(queries[0].sql).toContain('"myschema"."article_tags"');
      expect(queries[0].sql).toMatchSnapshot();
    });

    test("uses unqualified table name when namespace is null", async () => {
      const entities = [{ id: "e1" }];
      const { client, queries } = createMockClient([]);

      await loadEmbeddedListRowsBatch(
        entities as any,
        primitiveEmbeddedList,
        client,
        null,
      );

      expect(queries[0].sql).toContain('"article_tags"');
      expect(queries[0].sql).not.toContain("null");
    });

    test("issues exactly one query regardless of entity count", async () => {
      const entities = [
        { id: "x1" },
        { id: "x2" },
        { id: "x3" },
        { id: "x4" },
        { id: "x5" },
      ];
      const { client, queries } = createMockClient([]);

      await loadEmbeddedListRowsBatch(
        entities as any,
        primitiveEmbeddedList,
        client,
        null,
      );

      expect(queries).toHaveLength(1);
    });
  });

  describe("early-exit when empty", () => {
    test("returns without querying when entities array is empty", async () => {
      const { client, queries } = createMockClient([]);

      await loadEmbeddedListRowsBatch([], primitiveEmbeddedList, client, null);

      expect(queries).toHaveLength(0);
    });
  });

  describe("primitive element distribution", () => {
    test("sets empty array on entity when no rows match its pk", async () => {
      const entities = [
        { id: "e1", tags: undefined as any },
        { id: "e2", tags: undefined as any },
      ];
      // Only rows for e1 are returned
      const rows = [
        { article_id: "e1", value: "alpha" },
        { article_id: "e1", value: "beta" },
      ];
      const { client } = createMockClient(rows);

      await loadEmbeddedListRowsBatch(
        entities as any,
        primitiveEmbeddedList,
        client,
        null,
      );

      expect((entities[1] as any).tags).toEqual([]);
    });

    test("distributes primitive rows to the correct entity by fk value", async () => {
      const entities = [
        { id: "e1", tags: undefined as any },
        { id: "e2", tags: undefined as any },
      ];
      const rows = [
        { article_id: "e1", value: "alpha" },
        { article_id: "e2", value: "gamma" },
        { article_id: "e1", value: "beta" },
      ];
      const { client } = createMockClient(rows);

      await loadEmbeddedListRowsBatch(
        entities as any,
        primitiveEmbeddedList,
        client,
        null,
      );

      expect((entities[0] as any).tags).toMatchSnapshot();
      expect((entities[1] as any).tags).toMatchSnapshot();
      expect((entities[0] as any).tags).toEqual(["alpha", "beta"]);
      expect((entities[1] as any).tags).toEqual(["gamma"]);
    });

    test("sets empty array when result set has no rows at all", async () => {
      const entities = [{ id: "e1", tags: ["stale"] as any }];
      const { client } = createMockClient([]);

      await loadEmbeddedListRowsBatch(
        entities as any,
        primitiveEmbeddedList,
        client,
        null,
      );

      expect((entities[0] as any).tags).toEqual([]);
    });

    test("distributes rows for three entities correctly", async () => {
      const entities = [
        { id: "e1", tags: undefined as any },
        { id: "e2", tags: undefined as any },
        { id: "e3", tags: undefined as any },
      ];
      const rows = [
        { article_id: "e3", value: "delta" },
        { article_id: "e1", value: "alpha" },
        { article_id: "e2", value: "beta" },
        { article_id: "e1", value: "gamma" },
      ];
      const { client } = createMockClient(rows);

      await loadEmbeddedListRowsBatch(
        entities as any,
        primitiveEmbeddedList,
        client,
        null,
      );

      expect((entities[0] as any).tags).toEqual(["alpha", "gamma"]);
      expect((entities[1] as any).tags).toEqual(["beta"]);
      expect((entities[2] as any).tags).toEqual(["delta"]);
    });
  });

  describe("embeddable element distribution", () => {
    test("hydrates embeddable instances and distributes them to the correct entity", async () => {
      const entities = [
        { id: "e1", tagObjects: undefined as any },
        { id: "e2", tagObjects: undefined as any },
      ];
      const rows = [
        { article_id: "e1", label: "important", score: 10 },
        { article_id: "e2", label: "minor", score: 2 },
        { article_id: "e1", label: "critical", score: 99 },
      ];
      const { client } = createMockClient(rows);

      await loadEmbeddedListRowsBatch(
        entities as any,
        embeddableEmbeddedList,
        client,
        null,
      );

      expect((entities[0] as any).tagObjects).toMatchSnapshot();
      expect((entities[1] as any).tagObjects).toMatchSnapshot();
      expect((entities[0] as any).tagObjects).toHaveLength(2);
      expect((entities[1] as any).tagObjects).toHaveLength(1);
      expect((entities[0] as any).tagObjects[0]).toBeInstanceOf(TagEmbeddable);
      expect((entities[0] as any).tagObjects[0].label).toBe("important");
      expect((entities[0] as any).tagObjects[0].score).toBe(10);
    });

    test("sets empty array when no rows match for embeddable entity", async () => {
      const entities = [
        { id: "e1", tagObjects: undefined as any },
        { id: "e2", tagObjects: undefined as any },
      ];
      const rows = [{ article_id: "e1", label: "only", score: 5 }];
      const { client } = createMockClient(rows);

      await loadEmbeddedListRowsBatch(
        entities as any,
        embeddableEmbeddedList,
        client,
        null,
      );

      expect((entities[1] as any).tagObjects).toEqual([]);
    });

    test("hydrates null field values on embeddable instances", async () => {
      const entities = [{ id: "e1", tagObjects: undefined as any }];
      const rows = [{ article_id: "e1", label: null, score: 7 }];
      const { client } = createMockClient(rows);

      await loadEmbeddedListRowsBatch(
        entities as any,
        embeddableEmbeddedList,
        client,
        null,
      );

      const item = (entities[0] as any).tagObjects[0];
      expect(item.label).toBeNull();
      expect(item.score).toBe(7);
    });

    test("applies transform.from() on embeddable field values when transform is defined", async () => {
      const transformFrom = jest.fn((v: unknown) => `transformed:${v}`);
      const embeddableListWithTransform: MetaEmbeddedList = {
        ...embeddableEmbeddedList,
        tableName: "transformed_tags",
        elementFields: [
          {
            ...makeField("label", { type: "string", name: "label" }),
            transform: { to: (v: unknown) => v, from: transformFrom },
          },
          makeField("score", { type: "integer", name: "score" }),
        ],
      };

      const entities = [{ id: "e1", tagObjects: undefined as any }];
      const rows = [{ article_id: "e1", label: "hello", score: 3 }];
      const { client } = createMockClient(rows);

      await loadEmbeddedListRowsBatch(
        entities as any,
        embeddableListWithTransform,
        client,
        null,
      );

      expect(transformFrom).toHaveBeenCalledWith("hello");
      expect((entities[0] as any).tagObjects[0].label).toBe("transformed:hello");
    });
  });

  describe("snapshot: complete batch result", () => {
    test("full batch distribution with mixed rows matches snapshot", async () => {
      const entities = [
        { id: "u1", tags: undefined as any },
        { id: "u2", tags: undefined as any },
        { id: "u3", tags: undefined as any },
      ];
      const rows = [
        { article_id: "u2", value: "x" },
        { article_id: "u1", value: "a" },
        { article_id: "u3", value: "c" },
        { article_id: "u1", value: "b" },
        { article_id: "u2", value: "y" },
      ];
      const { client } = createMockClient(rows);

      await loadEmbeddedListRowsBatch(
        entities as any,
        primitiveEmbeddedList,
        client,
        null,
      );

      expect(
        entities.map((e) => ({ id: e.id, tags: (e as any).tags })),
      ).toMatchSnapshot();
    });
  });
});

// ─── insertEmbeddedListRows ───────────────────────────────────────────────────

describe("insertEmbeddedListRows", () => {
  describe("early-exit conditions", () => {
    test("does not query when the array property is undefined", async () => {
      const entity = { id: "e1" }; // no "tags" key
      const { client, queries } = createMockClient();

      await insertEmbeddedListRows(entity as any, primitiveEmbeddedList, client, null);

      expect(queries).toHaveLength(0);
    });

    test("does not query when the array property is null", async () => {
      const entity = { id: "e1", tags: null };
      const { client, queries } = createMockClient();

      await insertEmbeddedListRows(entity as any, primitiveEmbeddedList, client, null);

      expect(queries).toHaveLength(0);
    });

    test("does not query when the array property is empty", async () => {
      const entity = { id: "e1", tags: [] };
      const { client, queries } = createMockClient();

      await insertEmbeddedListRows(entity as any, primitiveEmbeddedList, client, null);

      expect(queries).toHaveLength(0);
    });

    test("does not query when the property is not an array (non-array value)", async () => {
      const entity = { id: "e1", tags: "not-an-array" };
      const { client, queries } = createMockClient();

      await insertEmbeddedListRows(entity as any, primitiveEmbeddedList, client, null);

      expect(queries).toHaveLength(0);
    });
  });

  describe("primitive element insertion", () => {
    test("generates correct SQL for a single primitive element", async () => {
      const entity = { id: "e1", tags: ["alpha"] };
      const { client, queries } = createMockClient();

      await insertEmbeddedListRows(entity as any, primitiveEmbeddedList, client, null);

      expect(queries).toHaveLength(1);
      expect(queries[0]).toMatchSnapshot();
    });

    test("generates correct SQL for multiple primitive elements", async () => {
      const entity = { id: "e1", tags: ["alpha", "beta", "gamma"] };
      const { client, queries } = createMockClient();

      await insertEmbeddedListRows(entity as any, primitiveEmbeddedList, client, null);

      expect(queries).toHaveLength(1);
      expect(queries[0]).toMatchSnapshot();
    });

    test("uses qualified table name when namespace is provided", async () => {
      const entity = { id: "e1", tags: ["x"] };
      const { client, queries } = createMockClient();

      await insertEmbeddedListRows(
        entity as any,
        primitiveEmbeddedList,
        client,
        "myschema",
      );

      expect(queries[0].sql).toContain('"myschema"."article_tags"');
      expect(queries[0]).toMatchSnapshot();
    });

    test("includes __ordinal values starting from 0 in params", async () => {
      const entity = { id: "e1", tags: ["first", "second"] };
      const { client, queries } = createMockClient();

      await insertEmbeddedListRows(entity as any, primitiveEmbeddedList, client, null);

      // params: [pkValue, ordinal0, item0, pkValue, ordinal1, item1]
      const params = queries[0].params as Array<unknown>;
      expect(params[1]).toBe(0); // ordinal for first item
      expect(params[4]).toBe(1); // ordinal for second item
    });

    test("handles null primitive element values", async () => {
      const entity = { id: "e1", tags: [null, "valid"] };
      const { client, queries } = createMockClient();

      await insertEmbeddedListRows(entity as any, primitiveEmbeddedList, client, null);

      expect(queries[0]).toMatchSnapshot();
    });
  });

  describe("embeddable element insertion", () => {
    test("generates correct SQL for a single embeddable element", async () => {
      const tag = new TagEmbeddable();
      tag.label = "important";
      tag.score = 42;
      const entity = { id: "e1", tagObjects: [tag] };
      const { client, queries } = createMockClient();

      await insertEmbeddedListRows(entity as any, embeddableEmbeddedList, client, null);

      expect(queries).toHaveLength(1);
      expect(queries[0]).toMatchSnapshot();
    });

    test("generates correct SQL for multiple embeddable elements with correct ordinals", async () => {
      const tag1 = new TagEmbeddable();
      tag1.label = "first";
      tag1.score = 1;
      const tag2 = new TagEmbeddable();
      tag2.label = "second";
      tag2.score = 2;
      const entity = { id: "e1", tagObjects: [tag1, tag2] };
      const { client, queries } = createMockClient();

      await insertEmbeddedListRows(entity as any, embeddableEmbeddedList, client, null);

      expect(queries[0]).toMatchSnapshot();
    });

    test("handles null element object — field values become null", async () => {
      const entity = { id: "e1", tagObjects: [null] };
      const { client, queries } = createMockClient();

      await insertEmbeddedListRows(entity as any, embeddableEmbeddedList, client, null);

      expect(queries[0]).toMatchSnapshot();
    });

    test("applies transform.to() on embeddable field values when transform is defined", async () => {
      const transformTo = jest.fn((v: unknown) => `encoded:${v}`);
      const embeddableListWithTransform: MetaEmbeddedList = {
        ...embeddableEmbeddedList,
        tableName: "transformed_tags",
        elementFields: [
          {
            ...makeField("label", { type: "string", name: "label" }),
            transform: { to: transformTo, from: (v: unknown) => v },
          },
          makeField("score", { type: "integer", name: "score" }),
        ],
      };

      const tag = new TagEmbeddable();
      tag.label = "hello";
      tag.score = 5;
      const entity = { id: "e1", tagObjects: [tag] };
      const { client, queries } = createMockClient();

      await insertEmbeddedListRows(
        entity as any,
        embeddableListWithTransform,
        client,
        null,
      );

      expect(transformTo).toHaveBeenCalledWith("hello");
      expect(queries[0]).toMatchSnapshot();
    });

    test("uses qualified table name for embeddable list with namespace", async () => {
      const tag = new TagEmbeddable();
      tag.label = "x";
      tag.score = 0;
      const entity = { id: "e1", tagObjects: [tag] };
      const { client, queries } = createMockClient();

      await insertEmbeddedListRows(entity as any, embeddableEmbeddedList, client, "app");

      expect(queries[0].sql).toContain('"app"."article_tag_objects"');
      expect(queries[0]).toMatchSnapshot();
    });
  });
});

// ─── deleteEmbeddedListRows ───────────────────────────────────────────────────

describe("deleteEmbeddedListRows", () => {
  test("issues a DELETE WHERE fk = $1 for primitive list", async () => {
    const entity = { id: "e1", tags: ["x", "y"] };
    const { client, queries } = createMockClient();

    await deleteEmbeddedListRows(entity as any, primitiveEmbeddedList, client, null);

    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatchSnapshot();
  });

  test("issues a DELETE WHERE fk = $1 for embeddable list", async () => {
    const entity = { id: "e1", tagObjects: [] };
    const { client, queries } = createMockClient();

    await deleteEmbeddedListRows(entity as any, embeddableEmbeddedList, client, null);

    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatchSnapshot();
  });

  test("uses qualified table name when namespace is provided", async () => {
    const entity = { id: "e1", tags: [] };
    const { client, queries } = createMockClient();

    await deleteEmbeddedListRows(
      entity as any,
      primitiveEmbeddedList,
      client,
      "myschema",
    );

    expect(queries[0].sql).toContain('"myschema"."article_tags"');
    expect(queries[0]).toMatchSnapshot();
  });

  test("passes parent pk value as the sole parameter", async () => {
    const entity = { id: "abc-123", tags: [] };
    const { client, queries } = createMockClient();

    await deleteEmbeddedListRows(entity as any, primitiveEmbeddedList, client, null);

    expect(queries[0].params).toEqual(["abc-123"]);
  });

  test("always executes the query even when the entity array is empty", async () => {
    const entity = { id: "e1", tags: [] };
    const { client, queries } = createMockClient();

    await deleteEmbeddedListRows(entity as any, primitiveEmbeddedList, client, null);

    // deleteEmbeddedListRows has no early-exit — it always issues the DELETE
    expect(queries).toHaveLength(1);
  });
});

// ─── loadEmbeddedListRows ─────────────────────────────────────────────────────

describe("loadEmbeddedListRows", () => {
  describe("SQL generation", () => {
    test("issues SELECT with WHERE fk = $1 and ORDER BY __ordinal", async () => {
      const entity = { id: "e1" };
      const { client, queries } = createMockClient([]);

      await loadEmbeddedListRows(entity as any, primitiveEmbeddedList, client, null);

      expect(queries).toHaveLength(1);
      expect(queries[0]).toMatchSnapshot();
    });

    test("uses qualified table name when namespace is provided", async () => {
      const entity = { id: "e1" };
      const { client, queries } = createMockClient([]);

      await loadEmbeddedListRows(
        entity as any,
        primitiveEmbeddedList,
        client,
        "myschema",
      );

      expect(queries[0].sql).toContain('"myschema"."article_tags"');
      expect(queries[0]).toMatchSnapshot();
    });

    test("passes parent pk value as sole query parameter", async () => {
      const entity = { id: "pk-value-99" };
      const { client, queries } = createMockClient([]);

      await loadEmbeddedListRows(entity as any, primitiveEmbeddedList, client, null);

      expect(queries[0].params).toEqual(["pk-value-99"]);
    });
  });

  describe("empty result", () => {
    test("sets empty array on entity when query returns no rows", async () => {
      const entity: any = { id: "e1" };
      const { client } = createMockClient([]);

      await loadEmbeddedListRows(entity, primitiveEmbeddedList, client, null);

      expect(entity.tags).toEqual([]);
    });

    test("overwrites existing array on entity when result is empty", async () => {
      const entity: any = { id: "e1", tags: ["stale-value"] };
      const { client } = createMockClient([]);

      await loadEmbeddedListRows(entity, primitiveEmbeddedList, client, null);

      expect(entity.tags).toEqual([]);
    });
  });

  describe("primitive element hydration", () => {
    test("extracts value column from each row and assigns to entity", async () => {
      const entity: any = { id: "e1" };
      const rows = [
        { article_id: "e1", __ordinal: 0, value: "alpha" },
        { article_id: "e1", __ordinal: 1, value: "beta" },
      ];
      const { client } = createMockClient(rows);

      await loadEmbeddedListRows(entity, primitiveEmbeddedList, client, null);

      expect(entity.tags).toMatchSnapshot();
    });

    test("passes null values through without deserialising", async () => {
      const entity: any = { id: "e1" };
      const rows = [{ article_id: "e1", __ordinal: 0, value: null }];
      const { client } = createMockClient(rows);

      await loadEmbeddedListRows(entity, primitiveEmbeddedList, client, null);

      expect(entity.tags).toMatchSnapshot();
    });

    test("passes undefined values through without deserialising", async () => {
      const entity: any = { id: "e1" };
      const rows = [{ article_id: "e1", __ordinal: 0, value: undefined }];
      const { client } = createMockClient(rows);

      await loadEmbeddedListRows(entity, primitiveEmbeddedList, client, null);

      expect(entity.tags).toMatchSnapshot();
    });

    test("returns raw value when elementType is null", async () => {
      const listWithNullType: MetaEmbeddedList = {
        ...primitiveEmbeddedList,
        elementType: null,
      };
      const entity: any = { id: "e1" };
      const rows = [{ article_id: "e1", __ordinal: 0, value: "raw-string" }];
      const { client } = createMockClient(rows);

      await loadEmbeddedListRows(entity, listWithNullType, client, null);

      expect(entity.tags).toMatchSnapshot();
    });
  });

  describe("embeddable element hydration", () => {
    test("creates class instances and maps field values", async () => {
      const entity: any = { id: "e1" };
      const rows = [
        { article_id: "e1", __ordinal: 0, label: "important", score: 10 },
        { article_id: "e1", __ordinal: 1, label: "critical", score: 99 },
      ];
      const { client } = createMockClient(rows);

      await loadEmbeddedListRows(entity, embeddableEmbeddedList, client, null);

      expect(entity.tagObjects).toMatchSnapshot();
      expect(entity.tagObjects).toHaveLength(2);
      expect(entity.tagObjects[0]).toBeInstanceOf(TagEmbeddable);
      expect(entity.tagObjects[1]).toBeInstanceOf(TagEmbeddable);
    });

    test("sets field to null/undefined when raw row value is null", async () => {
      const entity: any = { id: "e1" };
      const rows = [{ article_id: "e1", __ordinal: 0, label: null, score: 5 }];
      const { client } = createMockClient(rows);

      await loadEmbeddedListRows(entity, embeddableEmbeddedList, client, null);

      expect(entity.tagObjects[0].label).toBeNull();
      expect(entity.tagObjects[0].score).toBe(5);
    });

    test("applies transform.from() on embeddable field values when transform is defined", async () => {
      const transformFrom = jest.fn((v: unknown) => `decoded:${v}`);
      const embeddableListWithTransform: MetaEmbeddedList = {
        ...embeddableEmbeddedList,
        tableName: "transformed_tags",
        elementFields: [
          {
            ...makeField("label", { type: "string", name: "label" }),
            transform: { to: (v: unknown) => v, from: transformFrom },
          },
          makeField("score", { type: "integer", name: "score" }),
        ],
      };

      const entity: any = { id: "e1" };
      const rows = [{ article_id: "e1", __ordinal: 0, label: "encoded-val", score: 3 }];
      const { client } = createMockClient(rows);

      await loadEmbeddedListRows(entity, embeddableListWithTransform, client, null);

      expect(transformFrom).toHaveBeenCalledWith("encoded-val");
      expect(entity.tagObjects[0].label).toBe("decoded:encoded-val");
    });

    test("snapshot for a single hydrated embeddable row", async () => {
      const entity: any = { id: "e1" };
      const rows = [{ article_id: "e1", __ordinal: 0, label: "snap-label", score: 77 }];
      const { client } = createMockClient(rows);

      await loadEmbeddedListRows(entity, embeddableEmbeddedList, client, null);

      expect(entity.tagObjects).toMatchSnapshot();
    });
  });
});

// ─── saveEmbeddedListRows ─────────────────────────────────────────────────────

describe("saveEmbeddedListRows", () => {
  test("executes DELETE then INSERT for primitive elements", async () => {
    const entity = { id: "e1", tags: ["alpha", "beta"] };
    const { client, queries } = createMockClient();

    await saveEmbeddedListRows(entity as any, primitiveEmbeddedList, client, null);

    expect(queries).toHaveLength(2);
    expect(queries[0].sql).toContain("DELETE");
    expect(queries[1].sql).toContain("INSERT");
    expect(queries).toMatchSnapshot();
  });

  test("executes DELETE then INSERT for embeddable elements", async () => {
    const tag = new TagEmbeddable();
    tag.label = "x";
    tag.score = 1;
    const entity = { id: "e1", tagObjects: [tag] };
    const { client, queries } = createMockClient();

    await saveEmbeddedListRows(entity as any, embeddableEmbeddedList, client, null);

    expect(queries).toHaveLength(2);
    expect(queries[0].sql).toContain("DELETE");
    expect(queries[1].sql).toContain("INSERT");
    expect(queries).toMatchSnapshot();
  });

  test("executes only DELETE when array is empty (no INSERT is issued)", async () => {
    const entity = { id: "e1", tags: [] };
    const { client, queries } = createMockClient();

    await saveEmbeddedListRows(entity as any, primitiveEmbeddedList, client, null);

    // INSERT has early-exit for empty arrays; DELETE always runs
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain("DELETE");
  });

  test("DELETE uses parent pk value from entity", async () => {
    const entity = { id: "target-pk", tags: ["x"] };
    const { client, queries } = createMockClient();

    await saveEmbeddedListRows(entity as any, primitiveEmbeddedList, client, null);

    expect(queries[0].params).toEqual(["target-pk"]);
  });

  test("INSERT params include correct pk value and ordinals", async () => {
    const entity = { id: "target-pk", tags: ["one", "two"] };
    const { client, queries } = createMockClient();

    await saveEmbeddedListRows(entity as any, primitiveEmbeddedList, client, null);

    const insertParams = queries[1].params as Array<unknown>;
    // [pkValue, ordinal0, "one", pkValue, ordinal1, "two"]
    expect(insertParams[0]).toBe("target-pk");
    expect(insertParams[1]).toBe(0);
    expect(insertParams[2]).toBe("one");
    expect(insertParams[3]).toBe("target-pk");
    expect(insertParams[4]).toBe(1);
    expect(insertParams[5]).toBe("two");
  });

  test("uses namespace in both DELETE and INSERT SQL", async () => {
    const entity = { id: "e1", tags: ["x"] };
    const { client, queries } = createMockClient();

    await saveEmbeddedListRows(entity as any, primitiveEmbeddedList, client, "ns");

    expect(queries[0].sql).toContain('"ns"."article_tags"');
    expect(queries[1].sql).toContain('"ns"."article_tags"');
  });

  test("snapshot for full save cycle with multiple primitive items", async () => {
    const entity = { id: "snap-pk", tags: ["a", "b", "c"] };
    const { client, queries } = createMockClient();

    await saveEmbeddedListRows(entity as any, primitiveEmbeddedList, client, null);

    expect(queries).toMatchSnapshot();
  });
});
