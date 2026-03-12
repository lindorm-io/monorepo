import { makeField } from "../../../../__fixtures__/make-field";
import type { EntityMetadata, MetaRelation } from "#internal/entity/types/metadata";
import type { IncludeSpec } from "#internal/types/query";
import type { ExecuteQueryIncludesOptions } from "./execute-query-includes";

// Mock the helpers that access the metadata registry and compile SQL
jest.mock("./get-relation-metadata");
jest.mock("./compile-relation-query");

import { findRelationByKey, getRelationMetadata } from "./get-relation-metadata";
import { compileRelationQuery } from "./compile-relation-query";
import { executeQueryIncludes } from "./execute-query-includes";

const mockFindRelationByKey = findRelationByKey as jest.MockedFunction<
  typeof findRelationByKey
>;
const mockGetRelationMetadata = getRelationMetadata as jest.MockedFunction<
  typeof getRelationMetadata
>;
const mockCompileRelationQuery = compileRelationQuery as jest.MockedFunction<
  typeof compileRelationQuery
>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeInclude = (
  relation: string,
  overrides: Partial<IncludeSpec> = {},
): IncludeSpec => ({
  relation,
  required: false,
  strategy: "query",
  select: null,
  where: null,
  ...overrides,
});

const makeRootMetadata = (): EntityMetadata =>
  ({
    entity: { decorator: "Entity", name: "Author", namespace: "app", comment: null },
    fields: [makeField("id", { type: "uuid" })],
    relations: [],
    primaryKeys: ["id"],
    filters: [],
  }) as unknown as EntityMetadata;

const makeForeignMeta = (name = "Post"): EntityMetadata =>
  ({
    target: class {},
    entity: { decorator: "Entity", name, namespace: null, comment: null },
    fields: [
      makeField("id", { type: "uuid" }),
      makeField("title", { type: "string" }),
      makeField("authorId", { type: "uuid", name: "author_id" }),
    ],
    relations: [],
    relationIds: [],
    primaryKeys: ["id"],
    filters: [],
    generated: [],
    uniques: [],
    checks: [],
    indexes: [],
    embeddedLists: [],
  }) as unknown as EntityMetadata;

const makeRelation = (overrides: Partial<MetaRelation> = {}): MetaRelation =>
  ({
    key: "posts",
    foreignConstructor: () => class Post {},
    foreignKey: "author",
    findKeys: null,
    joinKeys: null,
    joinTable: null,
    options: {} as any,
    orderBy: null,
    type: "OneToMany",
    ...overrides,
  }) as MetaRelation;

const makeOpts = (
  overrides: Partial<ExecuteQueryIncludesOptions> = {},
): ExecuteQueryIncludesOptions => ({
  rootMetadata: makeRootMetadata(),
  client: { query: jest.fn() } as any,
  namespace: "app",
  withDeleted: false,
  versionTimestamp: null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Early-exit conditions
// ---------------------------------------------------------------------------

describe("executeQueryIncludes — early exit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("does nothing when entities array is empty", async () => {
    const opts = makeOpts();
    await executeQueryIncludes([], [makeInclude("posts")], opts);

    expect(mockFindRelationByKey).not.toHaveBeenCalled();
    expect(mockCompileRelationQuery).not.toHaveBeenCalled();
    expect(opts.client.query).not.toHaveBeenCalled();
  });

  test("does nothing when queryIncludes array is empty", async () => {
    const entities = [{ id: "user-1" }] as any[];
    const opts = makeOpts();
    await executeQueryIncludes(entities, [], opts);

    expect(mockFindRelationByKey).not.toHaveBeenCalled();
    expect(mockCompileRelationQuery).not.toHaveBeenCalled();
    expect(opts.client.query).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Inverse relation (OneToMany — has findKeys, no joinKeys)
// ---------------------------------------------------------------------------

describe("executeQueryIncludes — inverse relation (OneToMany)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("assigns hydrated collection to matching entities", async () => {
    const relation = makeRelation({
      type: "OneToMany",
      findKeys: { authorId: "id" },
    });
    const foreignMeta = makeForeignMeta();

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);
    mockCompileRelationQuery.mockReturnValue({
      text: "SELECT ...",
      params: ["user-1"],
      relation,
      foreignMetadata: foreignMeta,
      include: makeInclude("posts"),
    });

    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [
          { id: "post-1", title: "First Post", author_id: "user-1" },
          { id: "post-2", title: "Second Post", author_id: "user-1" },
        ],
      }),
    };

    const entities: any[] = [{ id: "user-1" }];
    await executeQueryIncludes(
      entities,
      [makeInclude("posts")],
      makeOpts({ client: client as any }),
    );

    expect(entities[0].posts).toHaveLength(2);
    expect(entities[0].posts[0].id).toBe("post-1");
    expect(entities[0].posts[1].id).toBe("post-2");
  });

  test("assigns empty array when no matching foreign rows exist", async () => {
    const relation = makeRelation({
      type: "OneToMany",
      findKeys: { authorId: "id" },
    });
    const foreignMeta = makeForeignMeta();

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);
    mockCompileRelationQuery.mockReturnValue({
      text: "SELECT ...",
      params: [],
      relation,
      foreignMetadata: foreignMeta,
      include: makeInclude("posts"),
    });

    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };

    const entities: any[] = [{ id: "user-1" }];
    await executeQueryIncludes(
      entities,
      [makeInclude("posts")],
      makeOpts({ client: client as any }),
    );

    expect(entities[0].posts).toEqual([]);
  });

  test("groups rows correctly for multiple root entities", async () => {
    const relation = makeRelation({
      type: "OneToMany",
      findKeys: { authorId: "id" },
    });
    const foreignMeta = makeForeignMeta();

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);
    mockCompileRelationQuery.mockReturnValue({
      text: "SELECT ...",
      params: [],
      relation,
      foreignMetadata: foreignMeta,
      include: makeInclude("posts"),
    });

    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [
          { id: "post-1", title: "User1 Post", author_id: "user-1" },
          { id: "post-2", title: "User2 Post", author_id: "user-2" },
          { id: "post-3", title: "User1 Post2", author_id: "user-1" },
        ],
      }),
    };

    const entities: any[] = [{ id: "user-1" }, { id: "user-2" }];
    await executeQueryIncludes(
      entities,
      [makeInclude("posts")],
      makeOpts({ client: client as any }),
    );

    expect(entities[0].posts).toHaveLength(2);
    expect(entities[1].posts).toHaveLength(1);
  });

  test("deduplicates root entities with same PK value", async () => {
    // Two entity objects with the same PK value should share one query entry
    const relation = makeRelation({
      type: "OneToMany",
      findKeys: { authorId: "id" },
    });
    const foreignMeta = makeForeignMeta();

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);
    mockCompileRelationQuery.mockReturnValue({
      text: "SELECT ...",
      params: [],
      relation,
      foreignMetadata: foreignMeta,
      include: makeInclude("posts"),
    });

    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: "post-1", title: "Shared Post", author_id: "user-1" }],
      }),
    };

    // Two entity objects referencing same user-1
    const entity1: any = { id: "user-1" };
    const entity2: any = { id: "user-1" };
    await executeQueryIncludes(
      [entity1, entity2],
      [makeInclude("posts")],
      makeOpts({ client: client as any }),
    );

    // Both should receive the same posts array contents
    expect(entity1.posts).toHaveLength(1);
    expect(entity2.posts).toHaveLength(1);
  });

  test("hydrates fields using field.name (column name) as key in row", async () => {
    // Posts are in DB rows with column names, hydrateRow maps them to field keys
    const relation = makeRelation({
      type: "OneToMany",
      findKeys: { authorId: "id" },
    });
    const foreignMeta = makeForeignMeta();

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);
    mockCompileRelationQuery.mockReturnValue({
      text: "SELECT ...",
      params: [],
      relation,
      foreignMetadata: foreignMeta,
      include: makeInclude("posts"),
    });

    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: "post-1", title: "My Title", author_id: "user-1" }],
      }),
    };

    const entities: any[] = [{ id: "user-1" }];
    await executeQueryIncludes(
      entities,
      [makeInclude("posts")],
      makeOpts({ client: client as any }),
    );

    // authorId field in metadata has name: "author_id" — hydrateRow uses field.name for row lookup
    const hydratedPost = entities[0].posts[0];
    expect(hydratedPost.id).toBe("post-1");
    expect(hydratedPost.title).toBe("My Title");
    // authorId maps from row["author_id"]
    expect(hydratedPost.authorId).toBe("user-1");
  });

  test("respects include.select when hydrating rows", async () => {
    const relation = makeRelation({
      type: "OneToMany",
      findKeys: { authorId: "id" },
    });
    const foreignMeta = makeForeignMeta();

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);

    const include = makeInclude("posts", { select: ["id", "title"] });

    mockCompileRelationQuery.mockReturnValue({
      text: "SELECT ...",
      params: [],
      relation,
      foreignMetadata: foreignMeta,
      include,
    });

    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: "post-1", title: "My Title", author_id: "user-1" }],
      }),
    };

    const entities: any[] = [{ id: "user-1" }];
    await executeQueryIncludes(entities, [include], makeOpts({ client: client as any }));

    // authorId should NOT be present because it's not in include.select
    const hydratedPost = entities[0].posts[0];
    expect(hydratedPost.id).toBe("post-1");
    expect(hydratedPost.title).toBe("My Title");
    expect(hydratedPost.authorId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Owning relation (ManyToOne — has joinKeys)
// ---------------------------------------------------------------------------

describe("executeQueryIncludes — owning relation (ManyToOne)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("assigns null when the FK value on root entity is null", async () => {
    const relation = makeRelation({
      type: "ManyToOne",
      joinKeys: { authorId: "id" },
    });
    const foreignMeta = makeForeignMeta("Author");

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);

    const client = { query: jest.fn() };

    // Entity where authorId is null — FK is missing
    const entities: any[] = [{ id: "post-1", authorId: null }];
    await executeQueryIncludes(
      entities,
      [makeInclude("author")],
      makeOpts({ client: client as any }),
    );

    // Should set relation to null and never query
    expect(entities[0].author).toBeNull();
    expect(client.query).not.toHaveBeenCalled();
  });

  test("assigns single entity (not array) for non-collection relation", async () => {
    const relation = makeRelation({
      type: "ManyToOne",
      joinKeys: { authorId: "id" },
    });
    const foreignMeta = makeForeignMeta("Author");

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);
    mockCompileRelationQuery.mockReturnValue({
      text: "SELECT ...",
      params: [],
      relation,
      foreignMetadata: foreignMeta,
      include: makeInclude("author"),
    });

    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: "author-1", title: "Alice", author_id: null }],
      }),
    };

    const entities: any[] = [{ id: "post-1", authorId: "author-1" }];
    await executeQueryIncludes(
      entities,
      [makeInclude("author")],
      makeOpts({ client: client as any }),
    );

    // ManyToOne (isCollection = false) — should be a single object, not array
    expect(Array.isArray(entities[0].author)).toBe(false);
    expect(entities[0].author).not.toBeNull();
  });

  test("sets relation to null when no foreign rows match", async () => {
    const relation = makeRelation({
      type: "ManyToOne",
      joinKeys: { authorId: "id" },
    });
    const foreignMeta = makeForeignMeta("Author");

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);
    mockCompileRelationQuery.mockReturnValue({
      text: "SELECT ...",
      params: [],
      relation,
      foreignMetadata: foreignMeta,
      include: makeInclude("author"),
    });

    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };

    const entities: any[] = [{ id: "post-1", authorId: "author-missing" }];
    await executeQueryIncludes(
      entities,
      [makeInclude("author")],
      makeOpts({ client: client as any }),
    );

    expect(entities[0].author).toBeNull();
  });

  test("assigns null to entities whose FK was null (all FK values null, no query issued)", async () => {
    const relation = makeRelation({
      type: "ManyToOne",
      joinKeys: { authorId: "id" },
    });
    const foreignMeta = makeForeignMeta("Author");

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);

    const client = { query: jest.fn() };

    const entities: any[] = [
      { id: "post-1", authorId: null },
      { id: "post-2", authorId: undefined },
    ];

    await executeQueryIncludes(
      entities,
      [makeInclude("author")],
      makeOpts({ client: client as any }),
    );

    expect(entities[0].author).toBeNull();
    expect(entities[1].author).toBeNull();
    expect(client.query).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ManyToMany relation (has joinTable)
// ---------------------------------------------------------------------------

describe("executeQueryIncludes — ManyToMany", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("groups rows by __jt_ aliased join-table columns", async () => {
    const relation = makeRelation({
      type: "ManyToMany",
      key: "tags",
      joinKeys: { studentId: "id" },
      joinTable: "course_student",
    });
    const foreignMeta: EntityMetadata = {
      ...makeForeignMeta("Tag"),
      fields: [makeField("id", { type: "uuid" }), makeField("label", { type: "string" })],
      filters: [],
    } as unknown as EntityMetadata;

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);
    mockCompileRelationQuery.mockReturnValue({
      text: "SELECT ...",
      params: [],
      relation,
      foreignMetadata: foreignMeta,
      include: makeInclude("tags"),
    });

    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [
          { id: "tag-1", label: "JS", __jt_studentId: "student-1" },
          { id: "tag-2", label: "TS", __jt_studentId: "student-1" },
          { id: "tag-3", label: "Go", __jt_studentId: "student-2" },
        ],
      }),
    };

    const entities: any[] = [{ id: "student-1" }, { id: "student-2" }];
    await executeQueryIncludes(
      entities,
      [makeInclude("tags")],
      makeOpts({ client: client as any }),
    );

    expect(entities[0].tags).toHaveLength(2);
    expect(entities[1].tags).toHaveLength(1);
  });

  test("assigns empty array when no rows match a root entity in M2M", async () => {
    const relation = makeRelation({
      type: "ManyToMany",
      key: "tags",
      joinKeys: { studentId: "id" },
      joinTable: "course_student",
    });
    const foreignMeta: EntityMetadata = {
      ...makeForeignMeta("Tag"),
      fields: [makeField("id", { type: "uuid" }), makeField("label", { type: "string" })],
      filters: [],
    } as unknown as EntityMetadata;

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);
    mockCompileRelationQuery.mockReturnValue({
      text: "SELECT ...",
      params: [],
      relation,
      foreignMetadata: foreignMeta,
      include: makeInclude("tags"),
    });

    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };

    const entities: any[] = [{ id: "student-1" }];
    await executeQueryIncludes(
      entities,
      [makeInclude("tags")],
      makeOpts({ client: client as any }),
    );

    expect(entities[0].tags).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Multiple includes processed in sequence
// ---------------------------------------------------------------------------

describe("executeQueryIncludes — multiple includes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("processes multiple includes sequentially", async () => {
    const postsRelation = makeRelation({
      type: "OneToMany",
      key: "posts",
      findKeys: { authorId: "id" },
    });
    // profile is an owning-side relation with a non-null FK value
    const profileRelation = makeRelation({
      type: "OneToOne",
      key: "profile",
      joinKeys: { profileId: "id" },
    });

    const postsMeta = makeForeignMeta("Post");
    const profileMeta = makeForeignMeta("Profile");

    mockFindRelationByKey
      .mockReturnValueOnce(postsRelation)
      .mockReturnValueOnce(profileRelation);
    mockGetRelationMetadata
      .mockReturnValueOnce(postsMeta)
      .mockReturnValueOnce(profileMeta);
    mockCompileRelationQuery
      .mockReturnValueOnce({
        text: "SELECT posts...",
        params: [],
        relation: postsRelation,
        foreignMetadata: postsMeta,
        include: makeInclude("posts"),
      })
      .mockReturnValueOnce({
        text: "SELECT profile...",
        params: [],
        relation: profileRelation,
        foreignMetadata: profileMeta,
        include: makeInclude("profile"),
      });

    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [{ id: "post-1", title: "Post 1", author_id: "user-1" }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: "profile-1", title: "Profile", author_id: null }],
        }),
    };

    // Entity has a valid profileId so the profile query is issued
    const entities: any[] = [{ id: "user-1", profileId: "profile-1" }];
    await executeQueryIncludes(
      entities,
      [makeInclude("posts"), makeInclude("profile")],
      makeOpts({ client: client as any }),
    );

    expect(client.query).toHaveBeenCalledTimes(2);
    expect(entities[0].posts).toHaveLength(1);
    expect(entities[0].profile).not.toBeNull();
  });

  test("skips query for owning-side relation when FK is null", async () => {
    const postsRelation = makeRelation({
      type: "OneToMany",
      key: "posts",
      findKeys: { authorId: "id" },
    });
    const profileRelation = makeRelation({
      type: "OneToOne",
      key: "profile",
      joinKeys: { profileId: "id" },
    });

    const postsMeta = makeForeignMeta("Post");
    const profileMeta = makeForeignMeta("Profile");

    mockFindRelationByKey
      .mockReturnValueOnce(postsRelation)
      .mockReturnValueOnce(profileRelation);
    mockGetRelationMetadata
      .mockReturnValueOnce(postsMeta)
      .mockReturnValueOnce(profileMeta);
    mockCompileRelationQuery.mockReturnValueOnce({
      text: "SELECT posts...",
      params: [],
      relation: postsRelation,
      foreignMetadata: postsMeta,
      include: makeInclude("posts"),
    });

    const client = {
      query: jest.fn().mockResolvedValueOnce({
        rows: [{ id: "post-1", title: "Post 1", author_id: "user-1" }],
      }),
    };

    // profileId is null — the owning-side branch should skip the query and assign null
    const entities: any[] = [{ id: "user-1", profileId: null }];
    await executeQueryIncludes(
      entities,
      [makeInclude("posts"), makeInclude("profile")],
      makeOpts({ client: client as any }),
    );

    // Only the posts query was issued (profile skipped due to null FK)
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(entities[0].posts).toHaveLength(1);
    expect(entities[0].profile).toBeNull();
  });
});
