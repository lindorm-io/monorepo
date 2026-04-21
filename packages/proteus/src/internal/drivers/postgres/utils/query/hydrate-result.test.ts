import { makeField } from "../../../../__fixtures__/make-field.js";
import type { EntityMetadata, MetaRelation } from "../../../../entity/types/metadata.js";
import type { AliasMap } from "./compile-select.js";
import type { IncludeSpec } from "../../../../types/query.js";
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type Mock,
  type MockedFunction,
} from "vitest";

// Mock get-relation-metadata so includes tests do not require a real decorator-registered entity.
vi.mock("./get-relation-metadata.js");

import { getRelationMetadata } from "./get-relation-metadata.js";
import { hydrateRows } from "./hydrate-result.js";

const mockGetRelationMetadata = getRelationMetadata as MockedFunction<
  typeof getRelationMetadata
>;

// ---------------------------------------------------------------------------
// Shared root entity fixture
// ---------------------------------------------------------------------------

class UserEntity {
  id: string = "";
  name: string = "";
  email: string = "";
}

const metadata = {
  entity: { name: "users", namespace: "app" },
  target: UserEntity,
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("email", { type: "string", name: "email_address" }),
  ],
  primaryKeys: ["id"],
  relations: [],
  hooks: [],
  relationIds: [],
} as unknown as EntityMetadata;

const aliasMap: Array<AliasMap> = [
  { tableAlias: "t0", schema: "app", tableName: "users", relationKey: null, metadata },
];

// ---------------------------------------------------------------------------
// Basic hydration (no includes)
// ---------------------------------------------------------------------------

describe("hydrateRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return empty array for no rows", () => {
    expect(hydrateRows([], metadata, aliasMap, [])).toEqual([]);
  });

  test("should hydrate single row", () => {
    const rows = [{ t0_id: "abc-123", t0_name: "Alice", t0_email: "alice@test.com" }];
    const result = hydrateRows(rows, metadata, aliasMap, []);
    expect(result).toMatchSnapshot();
  });

  test("should hydrate multiple rows", () => {
    const rows = [
      { t0_id: "abc-123", t0_name: "Alice", t0_email: "alice@test.com" },
      { t0_id: "def-456", t0_name: "Bob", t0_email: "bob@test.com" },
    ];
    const result = hydrateRows(rows, metadata, aliasMap, []);
    expect(result).toMatchSnapshot();
  });

  test("should handle null values", () => {
    const rows = [{ t0_id: "abc-123", t0_name: "Alice", t0_email: null }];
    const result = hydrateRows(rows, metadata, aliasMap, []);
    expect(result[0]).toMatchSnapshot();
  });

  test("should map alias to entity property key", () => {
    const rows = [{ t0_id: "abc-123", t0_name: "Alice", t0_email: "alice@test.com" }];
    const result = hydrateRows(rows, metadata, aliasMap, []);
    // Key should be "email" (property name), not "email_address" (column name)
    expect(result[0]).toHaveProperty("email");
    expect(result[0]).not.toHaveProperty("email_address");
  });
});

// ---------------------------------------------------------------------------
// Shared foreign entity fixtures for includes tests
// ---------------------------------------------------------------------------

class PostEntity {
  id: string = "";
  title: string = "";
  authorId: string | null = null;
}

class AuthorEntity {
  id: string = "";
  name: string = "";
}

const postMeta: EntityMetadata = {
  entity: { name: "posts", namespace: "app" },
  target: PostEntity,
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("title", { type: "string" }),
    makeField("authorId", { type: "uuid", name: "author_id" }),
  ],
  primaryKeys: ["id"],
  relations: [],
  hooks: [],
  relationIds: [],
} as unknown as EntityMetadata;

const authorMeta: EntityMetadata = {
  entity: { name: "authors", namespace: "app" },
  target: AuthorEntity,
  fields: [makeField("id", { type: "uuid" }), makeField("name", { type: "string" })],
  primaryKeys: ["id"],
  relations: [],
  hooks: [],
  relationIds: [],
} as unknown as EntityMetadata;

// Root entity: Post (many-to-one → Author)
const m2oRelation: MetaRelation = {
  key: "author",
  foreignConstructor: () => AuthorEntity as any,
  foreignKey: "id",
  findKeys: null,
  joinKeys: { authorId: "id" },
  joinTable: null,
  type: "ManyToOne",
  options: {} as any,
  orderBy: null,
} as MetaRelation;

const postMetaWithAuthor: EntityMetadata = {
  ...postMeta,
  relations: [m2oRelation],
} as unknown as EntityMetadata;

// Root entity: Author (one-to-many → Post)
const o2mRelation: MetaRelation = {
  key: "posts",
  foreignConstructor: () => PostEntity as any,
  foreignKey: "author",
  findKeys: { authorId: "id" },
  joinKeys: null,
  joinTable: null,
  type: "OneToMany",
  options: {} as any,
  orderBy: null,
} as MetaRelation;

const authorMetaWithPosts: EntityMetadata = {
  ...authorMeta,
  relations: [o2mRelation],
} as unknown as EntityMetadata;

// AliasMap entries shared across includes tests
const postAliasMap: Array<AliasMap> = [
  {
    tableAlias: "t0",
    schema: "app",
    tableName: "posts",
    relationKey: null,
    metadata: postMetaWithAuthor,
  },
  {
    tableAlias: "t1",
    schema: "app",
    tableName: "authors",
    relationKey: "author",
    metadata: authorMeta,
  },
];

const authorAliasMap: Array<AliasMap> = [
  {
    tableAlias: "t0",
    schema: "app",
    tableName: "authors",
    relationKey: null,
    metadata: authorMetaWithPosts,
  },
  {
    tableAlias: "t1",
    schema: "app",
    tableName: "posts",
    relationKey: "posts",
    metadata: postMeta,
  },
];

const m2oInclude: IncludeSpec = {
  relation: "author",
  required: false,
  strategy: "join",
  select: null,
  where: null,
};

const o2mInclude: IncludeSpec = {
  relation: "posts",
  required: false,
  strategy: "join",
  select: null,
  where: null,
};

// ---------------------------------------------------------------------------
// T01 — hydrateRows with includes
// ---------------------------------------------------------------------------

describe("hydrateRows — with includes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // T01-1: ManyToOne include — single foreign entity per row
  // -------------------------------------------------------------------------

  test("ManyToOne include: hydrates a single related entity per root row", () => {
    mockGetRelationMetadata.mockReturnValue(authorMeta);

    const rows = [
      {
        t0_id: "post-1",
        t0_title: "Hello World",
        t0_authorId: "author-1",
        t1_id: "author-1",
        t1_name: "Alice",
      },
    ];

    const includes: Array<IncludeSpec> = [m2oInclude];

    const result = hydrateRows(rows, postMetaWithAuthor, postAliasMap, includes);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchSnapshot();
  });

  test("ManyToOne include: foreign entity carries correct field values", () => {
    mockGetRelationMetadata.mockReturnValue(authorMeta);

    const rows = [
      {
        t0_id: "post-2",
        t0_title: "Second Post",
        t0_authorId: "author-2",
        t1_id: "author-2",
        t1_name: "Bob",
      },
    ];

    const result = hydrateRows(rows, postMetaWithAuthor, postAliasMap, [m2oInclude]);

    const author = (result[0] as any).author;
    expect(author).not.toBeNull();
    expect(author.id).toBe("author-2");
    expect(author.name).toBe("Bob");
  });

  // -------------------------------------------------------------------------
  // T01-2: OneToMany deduplication — same root PK, multiple foreign rows
  // -------------------------------------------------------------------------

  test("OneToMany include: deduplicates root entity and aggregates related collection", () => {
    mockGetRelationMetadata.mockReturnValue(postMeta);

    // Two DB rows: same author, different posts
    const rows = [
      {
        t0_id: "author-1",
        t0_name: "Alice",
        t1_id: "post-1",
        t1_title: "First Post",
        t1_authorId: "author-1",
      },
      {
        t0_id: "author-1",
        t0_name: "Alice",
        t1_id: "post-2",
        t1_title: "Second Post",
        t1_authorId: "author-1",
      },
    ];

    const result = hydrateRows(rows, authorMetaWithPosts, authorAliasMap, [o2mInclude]);

    // Root entity appears only once
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchSnapshot();
  });

  test("OneToMany include: collection contains all related entities without duplicates", () => {
    mockGetRelationMetadata.mockReturnValue(postMeta);

    const rows = [
      {
        t0_id: "author-1",
        t0_name: "Alice",
        t1_id: "post-1",
        t1_title: "First Post",
        t1_authorId: "author-1",
      },
      {
        t0_id: "author-1",
        t0_name: "Alice",
        t1_id: "post-2",
        t1_title: "Second Post",
        t1_authorId: "author-1",
      },
      // Duplicate foreign row for post-1 — should not appear twice
      {
        t0_id: "author-1",
        t0_name: "Alice",
        t1_id: "post-1",
        t1_title: "First Post",
        t1_authorId: "author-1",
      },
    ];

    const result = hydrateRows(rows, authorMetaWithPosts, authorAliasMap, [o2mInclude]);
    const posts = (result[0] as any).posts as Array<unknown>;

    // Dedup keeps post-1 and post-2 only
    expect(posts).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // T01-3: NULL foreign PK (LEFT JOIN miss) — collection → empty array
  // -------------------------------------------------------------------------

  test("OneToMany include: null foreign PK row (LEFT JOIN miss) — collection is empty array", () => {
    mockGetRelationMetadata.mockReturnValue(postMeta);

    // A row where the LEFT JOIN found no match — all t1_* are null
    const rows = [
      {
        t0_id: "author-1",
        t0_name: "Alice",
        t1_id: null,
        t1_title: null,
        t1_authorId: null,
      },
    ];

    const result = hydrateRows(rows, authorMetaWithPosts, authorAliasMap, [o2mInclude]);

    expect(result).toHaveLength(1);
    const posts = (result[0] as any).posts as Array<unknown>;
    expect(posts).toEqual([]);
    expect(result[0]).toMatchSnapshot();
  });

  // -------------------------------------------------------------------------
  // T01-4: ManyToOne with null join — scalar relation should be null
  // -------------------------------------------------------------------------

  test("ManyToOne include: null foreign PK (LEFT JOIN miss) — scalar relation is null", () => {
    mockGetRelationMetadata.mockReturnValue(authorMeta);

    const rows = [
      {
        t0_id: "post-1",
        t0_title: "Orphaned Post",
        t0_authorId: null,
        t1_id: null,
        t1_name: null,
      },
    ];

    const result = hydrateRows(rows, postMetaWithAuthor, postAliasMap, [m2oInclude]);

    expect(result).toHaveLength(1);
    expect((result[0] as any).author).toBeNull();
    expect(result[0]).toMatchSnapshot();
  });

  // -------------------------------------------------------------------------
  // T01-5: inc.select partial field restriction — PKs always included
  // -------------------------------------------------------------------------

  test("inc.select restriction: only selected fields and PKs appear on the related entity", () => {
    mockGetRelationMetadata.mockReturnValue(postMeta);

    const rows = [
      {
        t0_id: "author-1",
        t0_name: "Alice",
        // With inc.select: ["title"], the query would only project t1_id and t1_title.
        // hydrate-result filters fields itself: PKs always kept per F05 fix.
        t1_id: "post-1",
        t1_title: "Hello",
        t1_authorId: null, // absent from projection but present in row for completeness
      },
    ];

    const selectInclude: IncludeSpec = {
      ...o2mInclude,
      select: ["title"],
    };

    const result = hydrateRows(rows, authorMetaWithPosts, authorAliasMap, [
      selectInclude,
    ]);
    const post = (result[0] as any).posts[0];

    // PK "id" must always be included (F05)
    expect(post.id).toBe("post-1");
    // Selected field present
    expect(post.title).toBe("Hello");
    // Non-selected, non-PK field: not populated from row data (retains class initializer default null)
    // defaultHydrateEntity skips fields not in restrictedMeta.fields — class initializer sets null
    expect(post.authorId).toBeNull();

    expect(result[0]).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// T10 — sortByOrderBy (tested via OneToMany includes path)
// ---------------------------------------------------------------------------

describe("hydrateRows — sortByOrderBy via OneToMany includes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const o2mWithOrderBy: MetaRelation = {
    ...o2mRelation,
    orderBy: { title: "ASC" },
  } as MetaRelation;

  const authorMetaWithOrderBy: EntityMetadata = {
    ...authorMetaWithPosts,
    relations: [o2mWithOrderBy],
  } as unknown as EntityMetadata;

  test("sorts OneToMany collection by orderBy ASC when items arrive in reverse order", () => {
    mockGetRelationMetadata.mockReturnValue(postMeta);

    const rows = [
      {
        t0_id: "author-1",
        t0_name: "Alice",
        t1_id: "post-b",
        t1_title: "Zebra",
        t1_authorId: "author-1",
      },
      {
        t0_id: "author-1",
        t0_name: "Alice",
        t1_id: "post-a",
        t1_title: "Apple",
        t1_authorId: "author-1",
      },
      {
        t0_id: "author-1",
        t0_name: "Alice",
        t1_id: "post-c",
        t1_title: "Mango",
        t1_authorId: "author-1",
      },
    ];

    const sortInclude: IncludeSpec = {
      ...o2mInclude,
    };

    const result = hydrateRows(rows, authorMetaWithOrderBy, authorAliasMap, [
      sortInclude,
    ]);
    const posts = (result[0] as any).posts as Array<any>;

    // ASC order: Apple → Mango → Zebra
    expect(posts[0].title).toBe("Apple");
    expect(posts[1].title).toBe("Mango");
    expect(posts[2].title).toBe("Zebra");
    expect(result[0]).toMatchSnapshot();
  });

  test("null values sort LAST for ASC (PostgreSQL NULLS LAST default)", () => {
    mockGetRelationMetadata.mockReturnValue(postMeta);

    const rows = [
      {
        t0_id: "author-1",
        t0_name: "Alice",
        t1_id: "post-null",
        t1_title: null,
        t1_authorId: "author-1",
      },
      {
        t0_id: "author-1",
        t0_name: "Alice",
        t1_id: "post-a",
        t1_title: "Apple",
        t1_authorId: "author-1",
      },
    ];

    const result = hydrateRows(rows, authorMetaWithOrderBy, authorAliasMap, [o2mInclude]);
    const posts = (result[0] as any).posts as Array<any>;

    // Null title sorts after non-null for ASC
    expect(posts[0].title).toBe("Apple");
    expect(posts[1].title).toBeNull();
  });

  test("null values sort FIRST for DESC (PostgreSQL NULLS FIRST default)", () => {
    mockGetRelationMetadata.mockReturnValue(postMeta);

    const descRelation: MetaRelation = {
      ...o2mWithOrderBy,
      orderBy: { title: "DESC" },
    } as MetaRelation;

    const authorMetaDesc: EntityMetadata = {
      ...authorMetaWithPosts,
      relations: [descRelation],
    } as unknown as EntityMetadata;

    const rows = [
      {
        t0_id: "author-1",
        t0_name: "Alice",
        t1_id: "post-a",
        t1_title: "Apple",
        t1_authorId: "author-1",
      },
      {
        t0_id: "author-1",
        t0_name: "Alice",
        t1_id: "post-null",
        t1_title: null,
        t1_authorId: "author-1",
      },
    ];

    const result = hydrateRows(rows, authorMetaDesc, authorAliasMap, [o2mInclude]);
    const posts = (result[0] as any).posts as Array<any>;

    // Null title sorts before non-null for DESC
    expect(posts[0].title).toBeNull();
    expect(posts[1].title).toBe("Apple");
  });
});

// ---------------------------------------------------------------------------
// T11 — Composite PK deduplication
// ---------------------------------------------------------------------------

describe("hydrateRows — composite PK deduplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  class TenantPostEntity {
    tenantId: string = "";
    id: string = "";
    title: string = "";
  }

  const tenantPostMeta: EntityMetadata = {
    entity: { name: "tenant_posts", namespace: "app" },
    target: TenantPostEntity,
    fields: [
      makeField("tenantId", { type: "uuid", name: "tenant_id" }),
      makeField("id", { type: "uuid" }),
      makeField("title", { type: "string" }),
    ],
    primaryKeys: ["tenantId", "id"],
    relations: [o2mRelation],
    hooks: [],
    relationIds: [],
  } as unknown as EntityMetadata;

  const tenantPostAliasMap: Array<AliasMap> = [
    {
      tableAlias: "t0",
      schema: "app",
      tableName: "tenant_posts",
      relationKey: null,
      metadata: tenantPostMeta,
    },
    {
      tableAlias: "t1",
      schema: "app",
      tableName: "posts",
      relationKey: "posts",
      metadata: postMeta,
    },
  ];

  test("groups rows by composite PK (tenantId + id) into a single root entity", () => {
    mockGetRelationMetadata.mockReturnValue(postMeta);

    const rows = [
      {
        t0_tenantId: "tenant-A",
        t0_id: "post-1",
        t0_title: "Multi Post",
        t1_id: "comment-1",
        t1_title: "Good read",
        t1_authorId: null,
      },
      {
        t0_tenantId: "tenant-A",
        t0_id: "post-1",
        t0_title: "Multi Post",
        t1_id: "comment-2",
        t1_title: "Great post",
        t1_authorId: null,
      },
    ];

    const result = hydrateRows(rows, tenantPostMeta, tenantPostAliasMap, [o2mInclude]);

    // Composite PK matches — two rows fold into one root entity
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchSnapshot();
  });

  test("keeps two separate root entities when composite PKs differ", () => {
    mockGetRelationMetadata.mockReturnValue(postMeta);

    const rows = [
      {
        t0_tenantId: "tenant-A",
        t0_id: "post-1",
        t0_title: "Post A",
        t1_id: "comment-1",
        t1_title: "Comment for A",
        t1_authorId: null,
      },
      {
        // Different tenantId → different composite PK even though id matches
        t0_tenantId: "tenant-B",
        t0_id: "post-1",
        t0_title: "Post B",
        t1_id: "comment-2",
        t1_title: "Comment for B",
        t1_authorId: null,
      },
    ];

    const result = hydrateRows(rows, tenantPostMeta, tenantPostAliasMap, [o2mInclude]);

    // Two distinct entities (different tenantId)
    expect(result).toHaveLength(2);
    expect(result).toMatchSnapshot();
  });

  test("composite PK dedup: each root entity gets its own related collection", () => {
    mockGetRelationMetadata.mockReturnValue(postMeta);

    const rows = [
      {
        t0_tenantId: "tenant-A",
        t0_id: "root-1",
        t0_title: "Root A",
        t1_id: "child-1",
        t1_title: "Child A1",
        t1_authorId: null,
      },
      {
        t0_tenantId: "tenant-A",
        t0_id: "root-1",
        t0_title: "Root A",
        t1_id: "child-2",
        t1_title: "Child A2",
        t1_authorId: null,
      },
      {
        t0_tenantId: "tenant-B",
        t0_id: "root-1",
        t0_title: "Root B",
        t1_id: "child-3",
        t1_title: "Child B1",
        t1_authorId: null,
      },
    ];

    const result = hydrateRows(rows, tenantPostMeta, tenantPostAliasMap, [o2mInclude]);

    expect(result).toHaveLength(2);

    const rootA = result.find((r) => (r as any).tenantId === "tenant-A") as any;
    const rootB = result.find((r) => (r as any).tenantId === "tenant-B") as any;

    expect(rootA.posts).toHaveLength(2);
    expect(rootB.posts).toHaveLength(1);
  });
});
