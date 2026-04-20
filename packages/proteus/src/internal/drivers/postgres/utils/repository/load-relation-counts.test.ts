import type { EntityMetadata, MetaRelation } from "../../../../entity/types/metadata";
import type { PostgresQueryClient } from "../../types/postgres-query-client";
import { loadRelationCounts, LoadRelationCountsContext } from "./load-relation-counts";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockedFunction,
} from "vitest";

vi.mock("../../../../entity/metadata/get-entity-metadata", () => ({
  getEntityMetadata: vi.fn(),
}));

import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata";

const mockGetEntityMetadata = getEntityMetadata as MockedFunction<
  typeof getEntityMetadata
>;

// --- helpers ---

const makeField = (key: string, name: string) => ({
  key,
  name,
  decorator: "Field" as const,
  arrayType: null,
  collation: null,
  comment: null,
  computed: null,
  embedded: null,
  encrypted: null,
  enum: null,
  default: null,
  hideOn: [],
  max: null,
  min: null,
  nullable: false,
  order: null,
  precision: null,
  readonly: false,
  scale: null,
  schema: null,
  transform: null,
  type: "string" as const,
});

const makeForeignMetadata = (
  entityName: string,
  namespace: string | null,
  fieldMappings: Array<[string, string]>,
  primaryKeys: Array<string> = ["id"],
): EntityMetadata =>
  ({
    entity: { decorator: "Entity", comment: null, name: entityName, namespace },
    fields: fieldMappings.map(([key, name]) => makeField(key, name)),
    primaryKeys,
    relations: [],
    relationIds: [],
    relationCounts: [],
    indexes: [],
    uniques: [],
    checks: [],
    scopeKeys: [],
    versionKeys: [],
    generated: [],
    hooks: [],
    extras: [],
    filters: [],
    schemas: [],
    embeddedLists: [],
    cache: null,
    defaultOrder: null,
  }) as unknown as EntityMetadata;

const makeOwnerMetadata = (
  relationCounts: EntityMetadata["relationCounts"],
  relations: Array<MetaRelation>,
): EntityMetadata =>
  ({
    entity: { decorator: "Entity", comment: null, name: "articles", namespace: null },
    fields: [makeField("id", "id")],
    primaryKeys: ["id"],
    relations,
    relationIds: [],
    relationCounts,
    indexes: [],
    uniques: [],
    checks: [],
    scopeKeys: [],
    versionKeys: [],
    generated: [],
    hooks: [],
    extras: [],
    filters: [],
    schemas: [],
    embeddedLists: [],
    cache: null,
    defaultOrder: null,
  }) as unknown as EntityMetadata;

const makeRelation = (overrides: Partial<MetaRelation> = {}): MetaRelation => ({
  key: "comments",
  foreignConstructor: () => class ForeignEntity {} as any,
  foreignKey: "articleId",
  findKeys: { article_id: "id" },
  joinKeys: null,
  joinTable: null,
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
  type: "OneToMany",
  ...overrides,
});

const makeClient = (rows: Array<Record<string, unknown>> = []): PostgresQueryClient => ({
  query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
});

// --- early exit cases ---

describe("loadRelationCounts — early exit", () => {
  it("should return without querying when entities array is empty", async () => {
    const client = makeClient();
    const metadata = makeOwnerMetadata(
      [{ key: "commentCount", relationKey: "comments" }],
      [makeRelation()],
    );
    await loadRelationCounts([], { metadata, namespace: "public", client });
    expect(client.query).not.toHaveBeenCalled();
  });

  it("should return without querying when relationCounts array is empty", async () => {
    const client = makeClient();
    const metadata = makeOwnerMetadata([], []);
    await loadRelationCounts([{ id: "a1" }] as any, {
      metadata,
      namespace: "public",
      client,
    });
    expect(client.query).not.toHaveBeenCalled();
  });

  it("should skip a relationCount when the relation is not found", async () => {
    const client = makeClient();
    const metadata = makeOwnerMetadata(
      [{ key: "commentCount", relationKey: "nonexistent" }],
      [],
    );
    await loadRelationCounts([{ id: "a1" }] as any, {
      metadata,
      namespace: "public",
      client,
    });
    expect(client.query).not.toHaveBeenCalled();
  });
});

// --- OneToMany counts ---

describe("loadRelationCounts — OneToMany", () => {
  const foreignMeta = makeForeignMetadata("comments", null, [
    ["articleId", "article_id"],
  ]);

  beforeEach(() => {
    mockGetEntityMetadata.mockReturnValue(foreignMeta);
  });

  it("should query foreign table with GROUP BY and COUNT", async () => {
    const client = makeClient([{ article_id: "a1", count: "3" }]);
    const relation = makeRelation({ type: "OneToMany", findKeys: { articleId: "id" } });
    const metadata = makeOwnerMetadata(
      [{ key: "commentCount", relationKey: "comments" }],
      [relation],
    );

    await loadRelationCounts([{ id: "a1" }] as any, {
      metadata,
      namespace: "public",
      client,
    });

    expect(client.query).toHaveBeenCalledTimes(1);
    const [sql, params] = (client.query as Mock).mock.calls[0];
    expect(sql).toContain("COUNT(*)");
    expect(sql).toContain("GROUP BY");
    expect(sql).toMatchSnapshot();
    expect(params).toMatchSnapshot();
  });

  it("should assign count to matching entities", async () => {
    const client = makeClient([{ article_id: "a1", count: "5" }]);
    const relation = makeRelation({ type: "OneToMany", findKeys: { articleId: "id" } });
    const metadata = makeOwnerMetadata(
      [{ key: "commentCount", relationKey: "comments" }],
      [relation],
    );
    const entities: any[] = [{ id: "a1" }, { id: "a1" }];

    await loadRelationCounts(entities, { metadata, namespace: "public", client });

    expect(entities[0].commentCount).toBe(5);
    expect(entities[1].commentCount).toBe(5);
  });

  it("should assign 0 count when entity has no matching rows in result", async () => {
    const client = makeClient([]);
    const relation = makeRelation({ type: "OneToMany", findKeys: { articleId: "id" } });
    const metadata = makeOwnerMetadata(
      [{ key: "commentCount", relationKey: "comments" }],
      [relation],
    );
    const entities: any[] = [{ id: "a99" }];

    await loadRelationCounts(entities, { metadata, namespace: "public", client });

    expect(entities[0].commentCount).toBe(0);
  });

  it("should handle multiple distinct entities in a single batched query", async () => {
    const client = makeClient([
      { article_id: "a1", count: "2" },
      { article_id: "a2", count: "7" },
    ]);
    const relation = makeRelation({ type: "OneToMany", findKeys: { articleId: "id" } });
    const metadata = makeOwnerMetadata(
      [{ key: "commentCount", relationKey: "comments" }],
      [relation],
    );
    const entities: any[] = [{ id: "a1" }, { id: "a2" }];

    await loadRelationCounts(entities, { metadata, namespace: "public", client });

    expect(entities[0].commentCount).toBe(2);
    expect(entities[1].commentCount).toBe(7);
  });

  it("should use foreignMeta.entity.namespace when available", async () => {
    const foreignMetaWithNs = makeForeignMetadata("comments", "foreign_ns", [
      ["articleId", "article_id"],
    ]);
    mockGetEntityMetadata.mockReturnValue(foreignMetaWithNs);

    const client = makeClient([{ article_id: "a1", count: "1" }]);
    const relation = makeRelation({ type: "OneToMany", findKeys: { articleId: "id" } });
    const metadata = makeOwnerMetadata(
      [{ key: "commentCount", relationKey: "comments" }],
      [relation],
    );

    await loadRelationCounts([{ id: "a1" }] as any, {
      metadata,
      namespace: "public",
      client,
    });

    const [sql] = (client.query as Mock).mock.calls[0];
    expect(sql).toContain('"foreign_ns"');
  });

  it("should fall back to ctx.namespace when foreignMeta has no namespace", async () => {
    const foreignMetaNoNs = makeForeignMetadata("comments", null, [
      ["articleId", "article_id"],
    ]);
    mockGetEntityMetadata.mockReturnValue(foreignMetaNoNs);

    const client = makeClient([{ article_id: "a1", count: "1" }]);
    const relation = makeRelation({ type: "OneToMany", findKeys: { articleId: "id" } });
    const metadata = makeOwnerMetadata(
      [{ key: "commentCount", relationKey: "comments" }],
      [relation],
    );

    await loadRelationCounts([{ id: "a1" }] as any, {
      metadata,
      namespace: "ctx_ns",
      client,
    });

    const [sql] = (client.query as Mock).mock.calls[0];
    expect(sql).toContain('"ctx_ns"');
  });

  it("should handle composite PK entities with multi-column findKeys", async () => {
    const compositeRelation = makeRelation({
      type: "OneToMany",
      findKeys: { tenant_id: "tenantId", article_id: "id" },
    });
    const compositeMetadata = makeOwnerMetadata(
      [{ key: "commentCount", relationKey: "comments" }],
      [compositeRelation],
    );
    // Override primaryKeys to reflect composite PK
    (compositeMetadata as any).primaryKeys = ["tenantId", "id"];

    const foreignMetaComposite = makeForeignMetadata("comments", null, [
      ["tenant_id", "tenant_id"],
      ["article_id", "article_id"],
    ]);
    mockGetEntityMetadata.mockReturnValue(foreignMetaComposite);

    const client = makeClient([
      { tenant_id: "t1", article_id: "a1", count: "3" },
      { tenant_id: "t1", article_id: "a2", count: "5" },
    ]);

    const entities: any[] = [
      { tenantId: "t1", id: "a1" },
      { tenantId: "t1", id: "a2" },
    ];

    await loadRelationCounts(entities, {
      metadata: compositeMetadata,
      namespace: "public",
      client,
    });

    expect(entities[0].commentCount).toBe(3);
    expect(entities[1].commentCount).toBe(5);
    const [sql, params] = (client.query as Mock).mock.calls[0];
    expect(sql).toMatchSnapshot();
    expect(params).toMatchSnapshot();
  });
});

// --- ManyToMany counts ---

describe("loadRelationCounts — ManyToMany", () => {
  const foreignMeta = makeForeignMetadata("tags", null, [["tagId", "tag_id"]]);

  beforeEach(() => {
    mockGetEntityMetadata.mockReturnValue(foreignMeta);
  });

  it("should query join table with GROUP BY and COUNT", async () => {
    const client = makeClient([{ article_id: "a1", count: "4" }]);
    const relation = makeRelation({
      type: "ManyToMany",
      joinKeys: { article_id: "id" },
      joinTable: "articles_x_tags",
    });
    const metadata = makeOwnerMetadata(
      [{ key: "tagCount", relationKey: "comments" }],
      [relation],
    );

    await loadRelationCounts([{ id: "a1" }] as any, {
      metadata,
      namespace: "public",
      client,
    });

    const [sql, params] = (client.query as Mock).mock.calls[0];
    expect(sql).toContain("COUNT(*)");
    expect(sql).toContain("articles_x_tags");
    expect(sql).toMatchSnapshot();
    expect(params).toMatchSnapshot();
  });

  it("should assign ManyToMany count to entities", async () => {
    const client = makeClient([{ article_id: "a1", count: "8" }]);
    const relation = makeRelation({
      type: "ManyToMany",
      joinKeys: { article_id: "id" },
      joinTable: "articles_x_tags",
    });
    const metadata = makeOwnerMetadata(
      [{ key: "tagCount", relationKey: "comments" }],
      [relation],
    );
    const entities: any[] = [{ id: "a1" }];

    await loadRelationCounts(entities, { metadata, namespace: "public", client });

    expect(entities[0].tagCount).toBe(8);
  });

  it("should skip ManyToMany when joinTable is not a string (true/null)", async () => {
    const client = makeClient();
    const relation = makeRelation({
      type: "ManyToMany",
      joinKeys: { article_id: "id" },
      joinTable: true, // not a string
    });
    const metadata = makeOwnerMetadata(
      [{ key: "tagCount", relationKey: "comments" }],
      [relation],
    );

    await loadRelationCounts([{ id: "a1" }] as any, {
      metadata,
      namespace: "public",
      client,
    });

    expect(client.query).not.toHaveBeenCalled();
  });

  it("should skip ManyToMany when relation is inverse side (joinKeys is null)", async () => {
    const client = makeClient();
    const relation = makeRelation({
      type: "ManyToMany",
      joinKeys: null, // inverse side
      joinTable: "articles_x_tags", // still a string
    });
    const metadata = makeOwnerMetadata(
      [{ key: "tagCount", relationKey: "comments" }],
      [relation],
    );

    await loadRelationCounts([{ id: "a1" }] as any, {
      metadata,
      namespace: "public",
      client,
    });

    expect(client.query).not.toHaveBeenCalled();
  });

  it("should query join table with GROUP BY and COUNT for composite joinKeys", async () => {
    const client = makeClient([
      { article_ns: "t1", article_id: "a1", count: "6" },
      { article_ns: "t1", article_id: "a2", count: "9" },
    ]);
    const relation = makeRelation({
      type: "ManyToMany",
      joinKeys: { article_ns: "tenantId", article_id: "id" },
      joinTable: "articles_x_tags",
    });
    const metadata = makeOwnerMetadata(
      [{ key: "tagCount", relationKey: "comments" }],
      [relation],
    );
    const entities: any[] = [
      { tenantId: "t1", id: "a1" },
      { tenantId: "t1", id: "a2" },
    ];

    await loadRelationCounts(entities, { metadata, namespace: "public", client });

    expect(entities[0].tagCount).toBe(6);
    expect(entities[1].tagCount).toBe(9);
    const [sql, params] = (client.query as Mock).mock.calls[0];
    expect(sql).toMatchSnapshot();
    expect(params).toMatchSnapshot();
  });
});

// --- ManyToOne / OneToOne skipped ---

describe("loadRelationCounts — relation type skipping", () => {
  const foreignMeta = makeForeignMetadata("profiles", null, [["userId", "user_id"]]);

  beforeEach(() => {
    mockGetEntityMetadata.mockReturnValue(foreignMeta);
  });

  it("should skip ManyToOne relations (counts on single end do not make sense)", async () => {
    const client = makeClient();
    const relation = makeRelation({ type: "ManyToOne" });
    const metadata = makeOwnerMetadata(
      [{ key: "ownerCount", relationKey: "comments" }],
      [relation],
    );

    await loadRelationCounts([{ id: "a1" }] as any, {
      metadata,
      namespace: "public",
      client,
    });

    expect(client.query).not.toHaveBeenCalled();
  });

  it("should skip OneToOne relations", async () => {
    const client = makeClient();
    const relation = makeRelation({ type: "OneToOne", findKeys: { userId: "id" } });
    const metadata = makeOwnerMetadata(
      [{ key: "profileCount", relationKey: "comments" }],
      [relation],
    );

    await loadRelationCounts([{ id: "a1" }] as any, {
      metadata,
      namespace: "public",
      client,
    });

    expect(client.query).not.toHaveBeenCalled();
  });
});
