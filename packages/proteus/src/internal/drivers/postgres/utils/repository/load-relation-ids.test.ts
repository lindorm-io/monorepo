import type { EntityMetadata, MetaRelation } from "../../../../entity/types/metadata";
import type { PostgresQueryClient } from "../../types/postgres-query-client";
import { loadRelationIds, LoadRelationIdsContext } from "./load-relation-ids";
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
  extraRelations: Array<MetaRelation> = [],
): EntityMetadata =>
  ({
    entity: { decorator: "Entity", comment: null, name: entityName, namespace },
    fields: fieldMappings.map(([key, name]) => makeField(key, name)),
    primaryKeys,
    relations: extraRelations,
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
  relationIds: EntityMetadata["relationIds"],
  relations: Array<MetaRelation>,
): EntityMetadata =>
  ({
    entity: { decorator: "Entity", comment: null, name: "articles", namespace: null },
    fields: [makeField("id", "id")],
    primaryKeys: ["id"],
    relations,
    relationIds,
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

const makeRelation = (overrides: Partial<MetaRelation> = {}): MetaRelation => ({
  key: "comments",
  foreignConstructor: () => class ForeignEntity {} as any,
  foreignKey: "articleId",
  findKeys: { articleId: "id" },
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

// --- early exit ---

describe("loadRelationIds — early exit", () => {
  it("should return without querying when entities array is empty", async () => {
    const client = makeClient();
    const metadata = makeOwnerMetadata(
      [{ key: "commentIds", relationKey: "comments", column: null }],
      [makeRelation()],
    );
    await loadRelationIds([], { metadata, namespace: "public", client });
    expect(client.query).not.toHaveBeenCalled();
  });

  it("should return without querying when relationIds array is empty", async () => {
    const client = makeClient();
    const metadata = makeOwnerMetadata([], []);
    await loadRelationIds([{ id: "a1" }] as any, {
      metadata,
      namespace: "public",
      client,
    });
    expect(client.query).not.toHaveBeenCalled();
  });

  it("should skip a relationId when the relation is not found", async () => {
    const client = makeClient();
    const metadata = makeOwnerMetadata(
      [{ key: "commentIds", relationKey: "nonexistent", column: null }],
      [],
    );
    await loadRelationIds([{ id: "a1" }] as any, {
      metadata,
      namespace: "public",
      client,
    });
    expect(client.query).not.toHaveBeenCalled();
  });

  it("should skip owning *ToOne relations (handled synchronously during hydration)", async () => {
    const client = makeClient();
    // ManyToOne with joinKeys = owning side — should be skipped
    const relation = makeRelation({
      type: "ManyToOne",
      joinKeys: { author_id: "id" },
      findKeys: null,
    });
    const metadata = makeOwnerMetadata(
      [{ key: "authorId", relationKey: "comments", column: null }],
      [relation],
    );
    await loadRelationIds([{ id: "a1" }] as any, {
      metadata,
      namespace: "public",
      client,
    });
    expect(client.query).not.toHaveBeenCalled();
  });

  it("should skip OneToOne owning side", async () => {
    const client = makeClient();
    const relation = makeRelation({
      type: "OneToOne",
      joinKeys: { profile_id: "id" },
      findKeys: null,
    });
    const metadata = makeOwnerMetadata(
      [{ key: "profileId", relationKey: "comments", column: null }],
      [relation],
    );
    await loadRelationIds([{ id: "a1" }] as any, {
      metadata,
      namespace: "public",
      client,
    });
    expect(client.query).not.toHaveBeenCalled();
  });
});

// --- OneToMany ids ---

describe("loadRelationIds — OneToMany", () => {
  const foreignMeta = makeForeignMetadata("comments", null, [
    ["articleId", "article_id"],
  ]);

  beforeEach(() => {
    mockGetEntityMetadata.mockReturnValue(foreignMeta);
  });

  it("should query foreign table and assign IDs to entities", async () => {
    const client = makeClient([
      { article_id: "a1", id: "c1" },
      { article_id: "a1", id: "c2" },
    ]);
    const relation = makeRelation({ type: "OneToMany", findKeys: { articleId: "id" } });
    const metadata = makeOwnerMetadata(
      [{ key: "commentIds", relationKey: "comments", column: null }],
      [relation],
    );
    const entities: any[] = [{ id: "a1" }];

    await loadRelationIds(entities, { metadata, namespace: "public", client });

    expect(entities[0].commentIds).toEqual(["c1", "c2"]);
  });

  it("should build SQL with SELECT of FK and target columns", async () => {
    const client = makeClient([{ article_id: "a1", id: "c1" }]);
    const relation = makeRelation({ type: "OneToMany", findKeys: { articleId: "id" } });
    const metadata = makeOwnerMetadata(
      [{ key: "commentIds", relationKey: "comments", column: null }],
      [relation],
    );

    await loadRelationIds([{ id: "a1" }] as any, {
      metadata,
      namespace: "public",
      client,
    });

    const [sql, params] = (client.query as Mock).mock.calls[0];
    expect(sql).toContain("SELECT");
    expect(sql).toContain("WHERE");
    expect(sql).toMatchSnapshot();
    expect(params).toMatchSnapshot();
  });

  it("should assign empty array when no rows match", async () => {
    const client = makeClient([]);
    const relation = makeRelation({ type: "OneToMany", findKeys: { articleId: "id" } });
    const metadata = makeOwnerMetadata(
      [{ key: "commentIds", relationKey: "comments", column: null }],
      [relation],
    );
    const entities: any[] = [{ id: "a99" }];

    await loadRelationIds(entities, { metadata, namespace: "public", client });

    expect(entities[0].commentIds).toEqual([]);
  });

  it("should group results correctly for multiple distinct entities", async () => {
    const client = makeClient([
      { article_id: "a1", id: "c1" },
      { article_id: "a2", id: "c2" },
      { article_id: "a2", id: "c3" },
    ]);
    const relation = makeRelation({ type: "OneToMany", findKeys: { articleId: "id" } });
    const metadata = makeOwnerMetadata(
      [{ key: "commentIds", relationKey: "comments", column: null }],
      [relation],
    );
    const entities: any[] = [{ id: "a1" }, { id: "a2" }];

    await loadRelationIds(entities, { metadata, namespace: "public", client });

    expect(entities[0].commentIds).toEqual(["c1"]);
    expect(entities[1].commentIds).toEqual(["c2", "c3"]);
  });

  it("should use ri.column to select specific column when provided", async () => {
    const foreignMeta2 = makeForeignMetadata("comments", null, [
      ["articleId", "article_id"],
      ["slug", "slug"],
    ]);
    mockGetEntityMetadata.mockReturnValue(foreignMeta2);

    const client = makeClient([{ article_id: "a1", slug: "my-comment" }]);
    const relation = makeRelation({ type: "OneToMany", findKeys: { articleId: "id" } });
    const metadata = makeOwnerMetadata(
      [{ key: "commentSlugs", relationKey: "comments", column: "slug" }],
      [relation],
    );
    const entities: any[] = [{ id: "a1" }];

    await loadRelationIds(entities, { metadata, namespace: "public", client });

    expect(entities[0].commentSlugs).toEqual(["my-comment"]);
  });
});

// --- Inverse OneToOne ids ---

describe("loadRelationIds — inverse OneToOne", () => {
  const foreignMeta = makeForeignMetadata("profiles", null, [["userId", "user_id"]]);

  beforeEach(() => {
    mockGetEntityMetadata.mockReturnValue(foreignMeta);
  });

  it("should query foreign table and assign single ID value", async () => {
    const client = makeClient([{ user_id: "u1", id: "p1" }]);
    const relation = makeRelation({
      type: "OneToOne",
      joinKeys: null, // inverse side — no joinKeys
      findKeys: { userId: "id" },
    });
    const metadata = makeOwnerMetadata(
      [{ key: "profileId", relationKey: "comments", column: null }],
      [relation],
    );
    const entities: any[] = [{ id: "u1" }];

    await loadRelationIds(entities, { metadata, namespace: "public", client });

    expect(entities[0].profileId).toBe("p1");
  });

  it("should assign null when no row found for entity", async () => {
    const client = makeClient([]);
    const relation = makeRelation({
      type: "OneToOne",
      joinKeys: null,
      findKeys: { userId: "id" },
    });
    const metadata = makeOwnerMetadata(
      [{ key: "profileId", relationKey: "comments", column: null }],
      [relation],
    );
    const entities: any[] = [{ id: "u99" }];

    await loadRelationIds(entities, { metadata, namespace: "public", client });

    expect(entities[0].profileId).toBeNull();
  });

  it("should build a SELECT SQL for inverse OneToOne", async () => {
    const client = makeClient([{ user_id: "u1", id: "p1" }]);
    const relation = makeRelation({
      type: "OneToOne",
      joinKeys: null,
      findKeys: { userId: "id" },
    });
    const metadata = makeOwnerMetadata(
      [{ key: "profileId", relationKey: "comments", column: null }],
      [relation],
    );

    await loadRelationIds([{ id: "u1" }] as any, {
      metadata,
      namespace: "public",
      client,
    });

    const [sql] = (client.query as Mock).mock.calls[0];
    expect(sql).toContain("SELECT");
    expect(sql).toContain("profiles");
    expect(sql).toMatchSnapshot();
  });

  it("should handle composite PK entities and build a correct key per entity", async () => {
    // Foreign table: profiles, has two FK columns pointing back to the owner's composite PK:
    //   tenantId (column "tenant_id") → owner.tenantId
    //   id       (column "user_id")   → owner.id
    // Primary key of profiles is its own "id" column.
    const foreignMeta2 = makeForeignMetadata(
      "profiles",
      null,
      [
        ["tenantId", "tenant_id"],
        ["id", "user_id"],
        ["profileId", "id"],
      ],
      ["profileId"],
    );
    mockGetEntityMetadata.mockReturnValue(foreignMeta2);

    // DB row: FK columns + profile PK
    const client = makeClient([{ tenant_id: "t1", user_id: "u1", id: "p1" }]);

    // findKeys: { foreignFKField: localPKField }
    //   "tenantId" (foreign field key, column "tenant_id") → "tenantId" (owner entity key)
    //   "id"       (foreign field key, column "user_id")   → "id"       (owner entity key)
    const relation = makeRelation({
      type: "OneToOne",
      joinKeys: null,
      findKeys: { tenantId: "tenantId", id: "id" },
    });
    const metadata = makeOwnerMetadata(
      [{ key: "profileId", relationKey: "comments", column: null }],
      [relation],
    );
    const entities: any[] = [{ tenantId: "t1", id: "u1" }];

    await loadRelationIds(entities, { metadata, namespace: "public", client });

    expect(entities[0].profileId).toBe("p1");
  });

  it("should batch-load inverse OneToOne IDs for multiple entities", async () => {
    const client = makeClient([
      { user_id: "u1", id: "p1" },
      { user_id: "u2", id: "p2" },
    ]);
    const relation = makeRelation({
      type: "OneToOne",
      joinKeys: null,
      findKeys: { userId: "id" },
    });
    const metadata = makeOwnerMetadata(
      [{ key: "profileId", relationKey: "comments", column: null }],
      [relation],
    );
    const entities: any[] = [{ id: "u1" }, { id: "u2" }];

    await loadRelationIds(entities, { metadata, namespace: "public", client });

    expect(entities[0].profileId).toBe("p1");
    expect(entities[1].profileId).toBe("p2");
  });
});

// --- ManyToMany ids ---

describe("loadRelationIds — ManyToMany", () => {
  it("should query join table and group foreign IDs by owner", async () => {
    // Set up inverse relation on the foreign entity
    const inverseRelation = makeRelation({
      key: "articles",
      foreignKey: "comments",
      type: "ManyToMany",
      joinKeys: { tag_id: "id" }, // foreign side's join keys
      joinTable: "articles_x_tags",
    });
    const foreignMeta = makeForeignMetadata(
      "tags",
      null,
      [["tagId", "tag_id"]],
      ["id"],
      [inverseRelation],
    );
    mockGetEntityMetadata.mockReturnValue(foreignMeta);

    const client = makeClient([
      { article_id: "a1", tag_id: "t1" },
      { article_id: "a1", tag_id: "t2" },
    ]);

    const relation = makeRelation({
      key: "comments", // matches inverseRelation.foreignKey
      foreignKey: "articles", // matches inverseRelation.key
      type: "ManyToMany",
      joinKeys: { article_id: "id" },
      joinTable: "articles_x_tags",
    });
    const metadata = makeOwnerMetadata(
      [{ key: "tagIds", relationKey: "comments", column: null }],
      [relation],
    );
    const entities: any[] = [{ id: "a1" }];

    await loadRelationIds(entities, { metadata, namespace: "public", client });

    expect(entities[0].tagIds).toEqual(["t1", "t2"]);
  });

  it("should return empty array when no join rows found", async () => {
    const inverseRelation = makeRelation({
      key: "articles",
      foreignKey: "comments",
      type: "ManyToMany",
      joinKeys: { tag_id: "id" },
      joinTable: "articles_x_tags",
    });
    const foreignMeta = makeForeignMetadata(
      "tags",
      null,
      [["tagId", "tag_id"]],
      ["id"],
      [inverseRelation],
    );
    mockGetEntityMetadata.mockReturnValue(foreignMeta);

    const client = makeClient([]);
    const relation = makeRelation({
      key: "comments",
      foreignKey: "articles",
      type: "ManyToMany",
      joinKeys: { article_id: "id" },
      joinTable: "articles_x_tags",
    });
    const metadata = makeOwnerMetadata(
      [{ key: "tagIds", relationKey: "comments", column: null }],
      [relation],
    );
    const entities: any[] = [{ id: "a1" }];

    await loadRelationIds(entities, { metadata, namespace: "public", client });

    expect(entities[0].tagIds).toEqual([]);
  });

  it("should skip ManyToMany when no inverse relation found", async () => {
    // Foreign metadata has no inverse relation
    const foreignMeta = makeForeignMetadata("tags", null, [["tagId", "tag_id"]]);
    mockGetEntityMetadata.mockReturnValue(foreignMeta);

    const client = makeClient();
    const relation = makeRelation({
      key: "comments",
      foreignKey: "articles",
      type: "ManyToMany",
      joinKeys: { article_id: "id" },
      joinTable: "articles_x_tags",
    });
    const metadata = makeOwnerMetadata(
      [{ key: "tagIds", relationKey: "comments", column: null }],
      [relation],
    );

    await loadRelationIds([{ id: "a1" }] as any, {
      metadata,
      namespace: "public",
      client,
    });

    expect(client.query).not.toHaveBeenCalled();
  });

  it("should set entity field to [] when M2M inverse relation has no joinKeys", async () => {
    // Inverse relation exists but has joinKeys: null (not the owning side of the join table)
    const inverseRelationNoJoinKeys = makeRelation({
      key: "articles",
      foreignKey: "comments",
      type: "ManyToMany",
      joinKeys: null, // inverse side — no joinKeys
      joinTable: "articles_x_tags",
    });
    const foreignMeta = makeForeignMetadata(
      "tags",
      null,
      [["tagId", "tag_id"]],
      ["id"],
      [inverseRelationNoJoinKeys],
    );
    mockGetEntityMetadata.mockReturnValue(foreignMeta);

    const client = makeClient();
    const relation = makeRelation({
      key: "comments",
      foreignKey: "articles",
      type: "ManyToMany",
      joinKeys: { article_id: "id" },
      joinTable: "articles_x_tags",
    });
    const metadata = makeOwnerMetadata(
      [{ key: "tagIds", relationKey: "comments", column: null }],
      [relation],
    );
    const entities: any[] = [{ id: "a1" }, { id: "a2" }];

    await loadRelationIds(entities, { metadata, namespace: "public", client });

    // No query should be issued — inverse side has no joinKeys
    expect(client.query).not.toHaveBeenCalled();
    // Entity field must be set to [] (not undefined or null)
    expect(entities[0].tagIds).toEqual([]);
    expect(entities[1].tagIds).toEqual([]);
  });

  it("should skip ManyToMany when joinTable is not a string", async () => {
    const foreignMeta = makeForeignMetadata("tags", null, [["tagId", "tag_id"]]);
    mockGetEntityMetadata.mockReturnValue(foreignMeta);

    const client = makeClient();
    const relation = makeRelation({
      type: "ManyToMany",
      joinKeys: { article_id: "id" },
      joinTable: true, // not a string
    });
    const metadata = makeOwnerMetadata(
      [{ key: "tagIds", relationKey: "comments", column: null }],
      [relation],
    );

    await loadRelationIds([{ id: "a1" }] as any, {
      metadata,
      namespace: "public",
      client,
    });

    expect(client.query).not.toHaveBeenCalled();
  });

  it("should use ri.column to select the correct foreign join column", async () => {
    // inverseRelation.joinKeys has two entries:
    //   tag_id    → "id"   (the default first key)
    //   tag_slug  → "slug" (selected when ri.column = "slug")
    const inverseRelation = makeRelation({
      key: "articles",
      foreignKey: "comments",
      type: "ManyToMany",
      joinKeys: { tag_id: "id", tag_slug: "slug" },
      joinTable: "articles_x_tags",
    });
    const foreignMeta = makeForeignMetadata(
      "tags",
      null,
      [
        ["tagId", "tag_id"],
        ["slug", "slug"],
      ],
      ["id"],
      [inverseRelation],
    );
    mockGetEntityMetadata.mockReturnValue(foreignMeta);

    // The join table returns tag_slug values for this article
    const client = makeClient([
      { article_id: "a1", tag_slug: "alpha" },
      { article_id: "a1", tag_slug: "beta" },
    ]);

    const relation = makeRelation({
      key: "comments",
      foreignKey: "articles",
      type: "ManyToMany",
      joinKeys: { article_id: "id" },
      joinTable: "articles_x_tags",
    });
    const metadata = makeOwnerMetadata(
      // ri.column = "slug" → should pick "tag_slug" join column (value of slug in foreignJoinKeys)
      [{ key: "tagSlugs", relationKey: "comments", column: "slug" }],
      [relation],
    );
    const entities: any[] = [{ id: "a1" }];

    await loadRelationIds(entities, { metadata, namespace: "public", client });

    expect(entities[0].tagSlugs).toEqual(["alpha", "beta"]);
  });
});
