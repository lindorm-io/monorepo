import type { MetaRelation } from "../../../../entity/types/metadata.js";
import type { PostgresQueryClient } from "../../types/postgres-query-client.js";
import { deleteJoinTableRows, syncJoinTableRows } from "./manage-join-table.js";
import { describe, expect, test, vi, type Mock } from "vitest";

// Mock the external utilities before importing the module under test
vi.mock("../../../../entity/utils/get-join-name.js", async () => ({
  getJoinName: vi.fn(() => ({
    namespace: "public",
    name: "test_join_table",
    type: "join",
    parts: ["public", "join", "test_join_table"],
  })),
}));

vi.mock("../quote-identifier.js", () => ({
  quoteIdentifier: vi.fn((name: string) => `"${name}"`),
  quoteQualifiedName: vi.fn((namespace: string | null, name: string) =>
    namespace ? `"${namespace}"."${name}"` : `"${name}"`,
  ),
}));

// Helper to create a mock PostgresQueryClient that records all calls
const createMockClient = (
  initialRows: Array<Record<string, unknown>> = [],
): {
  client: PostgresQueryClient;
  queries: Array<{ sql: string; params?: Array<unknown> }>;
} => {
  const queries: Array<{ sql: string; params?: Array<unknown> }> = [];
  const client = {
    query: vi.fn(async (sql: string, params?: Array<unknown>) => {
      queries.push({ sql, params });
      const rows = sql.trimStart().startsWith("SELECT") ? initialRows : [];
      return {
        rows,
        rowCount: sql.trimStart().startsWith("SELECT") ? initialRows.length : 0,
      };
    }),
  } as unknown as PostgresQueryClient;
  return { client, queries };
};

// Minimal MetaRelation factory
const makeRelation = (overrides: Partial<MetaRelation> = {}): MetaRelation => ({
  key: "tags",
  foreignConstructor: () => class {} as any,
  foreignKey: "tagId",
  findKeys: null,
  joinKeys: null,
  joinTable: "articles_x_tags",
  options: {
    deferrable: false,
    initiallyDeferred: false,
    loading: { single: "lazy", multiple: "lazy" },
    nullable: true,
    onDestroy: "cascade",
    onInsert: "cascade",
    onOrphan: "ignore",
    onSoftDestroy: "ignore",
    onUpdate: "cascade",
    strategy: null,
  },
  orderBy: null,
  type: "ManyToMany",
  ...overrides,
});

// ─── syncJoinTableRows ────────────────────────────────────────────────────────

describe("syncJoinTableRows", () => {
  // The "owner" side has joinKeys (the FK columns it owns in the join table)
  // findKeys maps: joinTableColumn → entityKey (used to look up the entity's value)
  const ownerRelation = makeRelation({
    joinKeys: { article_id: "id" },
    findKeys: { article_id: "id" },
  });

  // The "target" (mirror) side has its own joinKeys and findKeys
  const mirrorRelation = makeRelation({
    key: "articles",
    joinKeys: { tag_id: "id" },
    findKeys: { tag_id: "id" },
  });

  const ownerEntity = { id: "article-1" };

  test("inserts new join rows when none exist", async () => {
    // No existing rows → SELECT returns empty
    const { client, queries } = createMockClient([]);

    const relatedEntities = [{ id: "tag-a" }, { id: "tag-b" }];
    await syncJoinTableRows(
      ownerEntity as any,
      relatedEntities as any,
      ownerRelation,
      mirrorRelation,
      client,
      "public",
    );

    // Query 1: SELECT existing rows
    // Query 2+: INSERT for each new related entity
    expect(queries.length).toBeGreaterThanOrEqual(3);
    const insertQueries = queries.filter((q) => q.sql.startsWith("INSERT"));
    expect(insertQueries).toHaveLength(2);
    expect(insertQueries[0]).toMatchSnapshot();
    expect(insertQueries[1]).toMatchSnapshot();
  });

  test("uses ON CONFLICT DO NOTHING for inserts", async () => {
    const { client, queries } = createMockClient([]);

    await syncJoinTableRows(
      ownerEntity as any,
      [{ id: "tag-a" }] as any,
      ownerRelation,
      mirrorRelation,
      client,
      "public",
    );

    const insertSql = queries.find((q) => q.sql.startsWith("INSERT"))?.sql ?? "";
    expect(insertSql).toContain("ON CONFLICT (");
    expect(insertSql).toContain("DO NOTHING");
    expect(insertSql).toMatchSnapshot();
  });

  test("deletes removed join rows when related entities shrink", async () => {
    // Existing row for tag-b; desired only has tag-a → tag-b should be deleted
    const { client, queries } = createMockClient([
      { article_id: "article-1", tag_id: "tag-a" },
      { article_id: "article-1", tag_id: "tag-b" },
    ]);

    await syncJoinTableRows(
      ownerEntity as any,
      [{ id: "tag-a" }] as any, // only tag-a desired
      ownerRelation,
      mirrorRelation,
      client,
      "public",
    );

    const deleteQueries = queries.filter((q) => q.sql.startsWith("DELETE"));
    expect(deleteQueries).toHaveLength(1);
    expect(deleteQueries[0]).toMatchSnapshot();
  });

  test("no-ops when existing rows exactly match desired", async () => {
    // Existing matches desired → no INSERT or DELETE
    const { client, queries } = createMockClient([
      { article_id: "article-1", tag_id: "tag-a" },
    ]);

    await syncJoinTableRows(
      ownerEntity as any,
      [{ id: "tag-a" }] as any,
      ownerRelation,
      mirrorRelation,
      client,
      "public",
    );

    // Only the initial SELECT should have been executed
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain("SELECT");
  });

  test("deletes all existing rows when relatedEntities is empty", async () => {
    const { client, queries } = createMockClient([
      { article_id: "article-1", tag_id: "tag-a" },
      { article_id: "article-1", tag_id: "tag-b" },
    ]);

    await syncJoinTableRows(
      ownerEntity as any,
      [], // no desired rows
      ownerRelation,
      mirrorRelation,
      client,
      "public",
    );

    const deleteQueries = queries.filter((q) => q.sql.startsWith("DELETE"));
    expect(deleteQueries).toHaveLength(2);
    expect(deleteQueries).toMatchSnapshot();
  });

  test("uses quoted identifiers in SELECT query", async () => {
    const { client, queries } = createMockClient([]);

    await syncJoinTableRows(
      ownerEntity as any,
      [],
      ownerRelation,
      mirrorRelation,
      client,
      "public",
    );

    const selectQuery = queries.find((q) => q.sql.startsWith("SELECT"));
    expect(selectQuery?.sql).toContain('"public"."test_join_table"');
    expect(selectQuery?.sql).toContain('"article_id"');
    expect(selectQuery?.sql).toMatchSnapshot();
  });

  test("returns early when ownerColumns is empty (no findKeys on relation)", async () => {
    const { client, queries } = createMockClient([]);

    const noFindKeysRelation = makeRelation({
      joinKeys: { article_id: "id" },
      findKeys: null, // no findKeys → ownerColumns will be empty
    });

    await syncJoinTableRows(
      ownerEntity as any,
      [{ id: "tag-a" }] as any,
      noFindKeysRelation,
      mirrorRelation,
      client,
      "public",
    );

    // Should not execute any queries
    expect(queries).toHaveLength(0);
  });

  test("returns early when mirror.findKeys is null (targetColEntries empty)", async () => {
    const { client, queries } = createMockClient([]);

    const ownerWithFindKeys = makeRelation({
      joinKeys: null,
      findKeys: { article_id: "id" },
    });
    const mirrorNoFindKeys = makeRelation({ joinKeys: null, findKeys: null });

    await syncJoinTableRows(
      ownerEntity as any,
      [{ id: "tag-a" }] as any,
      ownerWithFindKeys,
      mirrorNoFindKeys,
      client,
      "public",
    );

    // SELECT is executed, but returns early after targetColEntries guard
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain("SELECT");
  });

  test("uses quoted identifiers in INSERT query", async () => {
    const { client, queries } = createMockClient([]);

    await syncJoinTableRows(
      ownerEntity as any,
      [{ id: "tag-a" }] as any,
      ownerRelation,
      mirrorRelation,
      client,
      "public",
    );

    const insertQuery = queries.find((q) => q.sql.startsWith("INSERT"));
    expect(insertQuery?.sql).toContain('"article_id"');
    expect(insertQuery?.sql).toContain('"tag_id"');
    expect(insertQuery?.sql).toContain('"public"."test_join_table"');
  });

  test("uses quoted identifiers in DELETE query", async () => {
    const { client, queries } = createMockClient([
      { article_id: "article-1", tag_id: "tag-z" },
    ]);

    await syncJoinTableRows(
      ownerEntity as any,
      [], // empty desired → delete all existing
      ownerRelation,
      mirrorRelation,
      client,
      "public",
    );

    const deleteQuery = queries.find((q) => q.sql.startsWith("DELETE"));
    expect(deleteQuery?.sql).toContain('"article_id"');
    expect(deleteQuery?.sql).toContain('"tag_id"');
    expect(deleteQuery?.sql).toContain('"public"."test_join_table"');
  });

  test("handles composite primary keys on both sides", async () => {
    // Both owner and mirror have composite keys
    const compositeOwner = makeRelation({
      joinKeys: { article_ns: "namespace", article_id: "id" },
      findKeys: { article_ns: "namespace", article_id: "id" },
    });
    const compositeMirror = makeRelation({
      joinKeys: { tag_ns: "namespace", tag_id: "id" },
      findKeys: { tag_ns: "namespace", tag_id: "id" },
    });

    const compositeEntity = { namespace: "ns-1", id: "article-1" };
    const { client, queries } = createMockClient([]);

    await syncJoinTableRows(
      compositeEntity as any,
      [{ namespace: "ns-2", id: "tag-a" }] as any,
      compositeOwner,
      compositeMirror,
      client,
      "public",
    );

    const insertQuery = queries.find((q) => q.sql.startsWith("INSERT"));
    expect(insertQuery?.sql).toMatchSnapshot();
    expect(insertQuery?.params).toMatchSnapshot();
  });
});

// ─── deleteJoinTableRows ──────────────────────────────────────────────────────

describe("deleteJoinTableRows", () => {
  const ownerRelation = makeRelation({
    joinKeys: { article_id: "id" },
    findKeys: { article_id: "id" },
  });

  const ownerEntity = { id: "article-1" };

  test("deletes all join rows for the entity", async () => {
    const { client, queries } = createMockClient();

    await deleteJoinTableRows(ownerEntity as any, ownerRelation, client, "public");

    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatchSnapshot();
  });

  test("uses quoted identifiers in DELETE query", async () => {
    const { client, queries } = createMockClient();

    await deleteJoinTableRows(ownerEntity as any, ownerRelation, client, "public");

    expect(queries[0].sql).toContain('"public"."test_join_table"');
    expect(queries[0].sql).toContain('"article_id"');
    expect(queries[0].sql).toMatchSnapshot();
  });

  test("no-ops when findKeys is null (no owner columns)", async () => {
    const { client, queries } = createMockClient();

    const noFindKeysRelation = makeRelation({ findKeys: null });
    await deleteJoinTableRows(ownerEntity as any, noFindKeysRelation, client, "public");

    expect(queries).toHaveLength(0);
  });

  test("no-ops when findKeys is empty object", async () => {
    const { client, queries } = createMockClient();

    const emptyFindKeysRelation = makeRelation({ findKeys: {} });
    await deleteJoinTableRows(
      ownerEntity as any,
      emptyFindKeysRelation,
      client,
      "public",
    );

    expect(queries).toHaveLength(0);
  });

  test("builds correct WHERE clause params from entity values", async () => {
    const { client, queries } = createMockClient();

    await deleteJoinTableRows(ownerEntity as any, ownerRelation, client, "public");

    expect(queries[0].params).toEqual(["article-1"]);
  });

  test("handles composite owner key in WHERE clause", async () => {
    const compositeRelation = makeRelation({
      findKeys: { article_ns: "namespace", article_id: "id" },
    });
    const compositeEntity = { namespace: "ns-1", id: "article-1" };
    const { client, queries } = createMockClient();

    await deleteJoinTableRows(
      compositeEntity as any,
      compositeRelation,
      client,
      "public",
    );

    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatchSnapshot();
  });

  test("uses null namespace when namespace parameter is null", async () => {
    const { client, queries } = createMockClient();

    await deleteJoinTableRows(ownerEntity as any, ownerRelation, client, null);

    // quoteQualifiedName is mocked: with null namespace it returns just the table name
    expect(queries[0].sql).toContain('"test_join_table"');
  });
});
