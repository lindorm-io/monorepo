import { makeField } from "../../../../__fixtures__/make-field";
import type { EntityMetadata, MetaRelation } from "#internal/entity/types/metadata";
import type { IncludeSpec } from "#internal/types/query";
import type { RelationQueryContext } from "./compile-relation-query";

// Mock the two helpers that call getEntityMetadata under the hood
jest.mock("./get-relation-metadata");

import { findRelationByKey, getRelationMetadata } from "./get-relation-metadata";
import { compileRelationQuery } from "./compile-relation-query";

const mockFindRelationByKey = findRelationByKey as jest.MockedFunction<
  typeof findRelationByKey
>;
const mockGetRelationMetadata = getRelationMetadata as jest.MockedFunction<
  typeof getRelationMetadata
>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeInclude = (overrides: Partial<IncludeSpec> = {}): IncludeSpec => ({
  relation: "posts",
  required: false,
  strategy: "query",
  select: null,
  where: null,
  ...overrides,
});

const makeCtx = (
  overrides: Partial<RelationQueryContext> = {},
): RelationQueryContext => ({
  rootMetadata: makeRootMetadata(),
  namespace: "app",
  withDeleted: false,
  versionTimestamp: null,
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

const makeForeignMeta = (
  name = "Post",
  namespace: string | null = null,
): EntityMetadata =>
  ({
    entity: { decorator: "Entity", name, namespace, comment: null },
    fields: [
      makeField("id", { type: "uuid" }),
      makeField("title", { type: "string" }),
      makeField("authorId", { type: "uuid", name: "author_id" }),
    ],
    relations: [],
    primaryKeys: ["id"],
    filters: [],
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

// ---------------------------------------------------------------------------
// Inverse relation (OneToMany / no joinKeys)
// ---------------------------------------------------------------------------

describe("compileRelationQuery — inverse (OneToMany)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("compiles a basic inverse query with single root PK value", () => {
    const relation = makeRelation({
      findKeys: { authorId: "id" },
    });
    const foreignMeta = makeForeignMeta();

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);

    const include = makeInclude({ relation: "posts" });
    const rootPkValues = [["user-uuid-1"]];
    const ctx = makeCtx();

    const result = compileRelationQuery(include, rootPkValues, ctx);
    expect(result).toMatchSnapshot();
  });

  test("compiles inverse query with multiple root PK values", () => {
    const relation = makeRelation({
      findKeys: { authorId: "id" },
    });
    const foreignMeta = makeForeignMeta();

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);

    const include = makeInclude({ relation: "posts" });
    const rootPkValues = [["user-1"], ["user-2"], ["user-3"]];
    const ctx = makeCtx();

    const result = compileRelationQuery(include, rootPkValues, ctx);
    expect(result.text).toMatchSnapshot();
    expect(result.params).toEqual(["user-1", "user-2", "user-3"]);
  });

  test("includes extra FK columns in SELECT when FK key is not in metadata fields", () => {
    // authorId is not in the metadata.fields for this test
    const foreignMetaNoFkField: EntityMetadata = {
      ...makeForeignMeta(),
      fields: [
        makeField("id", { type: "uuid" }),
        makeField("title", { type: "string" }),
        // authorId deliberately omitted from fields
      ],
    } as unknown as EntityMetadata;

    const relation = makeRelation({
      findKeys: { authorId: "id" },
    });

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMetaNoFkField);

    const include = makeInclude();
    const result = compileRelationQuery(include, [["uuid-1"]], makeCtx());

    // authorId must appear in SELECT because it's not in fields
    expect(result.text).toContain('"authorId"');
    expect(result).toMatchSnapshot();
  });

  test("does not add extra FK columns in SELECT when FK key is already in metadata fields", () => {
    // authorId IS in the fields — it appears in SELECT once and in WHERE clause
    const foreignMeta = makeForeignMeta(); // has authorId in fields

    const relation = makeRelation({
      findKeys: { authorId: "id" },
    });

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);

    const include = makeInclude();
    const result = compileRelationQuery(include, [["uuid-1"]], makeCtx());

    // authorId is in fields, so no extra SELECT column is added.
    // "author_id" appears once in SELECT and once in WHERE.
    // Verify it's just the base columns in SELECT (no duplication):
    expect(result).toMatchSnapshot();
  });

  test("applies select filter when include.select is set", () => {
    const relation = makeRelation({ findKeys: { authorId: "id" } });
    const foreignMeta = makeForeignMeta();

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);

    const include = makeInclude({ select: ["id", "title"] });
    const result = compileRelationQuery(include, [["uuid-1"]], makeCtx());

    // The SELECT clause contains only the selected fields
    expect(result.text).toContain('"id"');
    expect(result.text).toContain('"title"');
    // author_id will still appear in the WHERE clause as the FK condition
    expect(result).toMatchSnapshot();
  });

  test("includes withDeleted filter when withDeleted is true", () => {
    const foreignMetaWithSoftDelete: EntityMetadata = {
      ...makeForeignMeta(),
      fields: [
        makeField("id", { type: "uuid" }),
        makeField("title", { type: "string" }),
        makeField("authorId", { type: "uuid", name: "author_id" }),
        makeField("deletedAt", {
          type: "timestamp",
          name: "deleted_at",
          decorator: "DeleteDate",
          nullable: true,
        }),
      ],
      filters: [],
    } as unknown as EntityMetadata;

    const relation = makeRelation({ findKeys: { authorId: "id" } });

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMetaWithSoftDelete);

    // withDeleted: false — should include the IS NULL soft-delete filter
    const ctxWithSoftDelete = makeCtx({ withDeleted: false });
    const result = compileRelationQuery(makeInclude(), [["uuid-1"]], ctxWithSoftDelete);

    expect(result.text).toContain("IS NULL");
    expect(result).toMatchSnapshot();
  });

  test("adds orderBy clause when relation has orderBy", () => {
    const relation = makeRelation({
      findKeys: { authorId: "id" },
      orderBy: { title: "ASC" },
    });
    const foreignMeta = makeForeignMeta();

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);

    const result = compileRelationQuery(makeInclude(), [["uuid-1"]], makeCtx());

    expect(result.text).toContain("ORDER BY");
    expect(result.text).toContain('"title"');
    expect(result.text).toContain("ASC");
    expect(result).toMatchSnapshot();
  });

  test("returns the correct relation and foreignMetadata on result", () => {
    const relation = makeRelation({ findKeys: { authorId: "id" } });
    const foreignMeta = makeForeignMeta();

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);

    const include = makeInclude();
    const result = compileRelationQuery(include, [["uuid-1"]], makeCtx());

    expect(result.relation).toBe(relation);
    expect(result.foreignMetadata).toBe(foreignMeta);
    expect(result.include).toBe(include);
  });
});

// ---------------------------------------------------------------------------
// Owning relation (ManyToOne / OneToOne with joinKeys)
// ---------------------------------------------------------------------------

describe("compileRelationQuery — owning side (has joinKeys)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("compiles owning-side query using foreign PK IN clause", () => {
    const relation = makeRelation({
      type: "ManyToOne",
      key: "author",
      joinKeys: { authorId: "id" }, // { localFKField: foreignPKField }
      findKeys: null,
    });
    const foreignMeta = makeForeignMeta("Author");

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);

    const include = makeInclude({ relation: "author" });
    const result = compileRelationQuery(include, [["author-uuid"]], makeCtx());

    expect(result.text).toContain("WHERE");
    expect(result.text).toContain("IN");
    expect(result.params).toEqual(["author-uuid"]);
    expect(result).toMatchSnapshot();
  });

  test("uses namespace from foreignMeta.entity when available", () => {
    const relation = makeRelation({
      type: "ManyToOne",
      joinKeys: { authorId: "id" },
    });
    const foreignMeta = makeForeignMeta("Author", "content");

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);

    const result = compileRelationQuery(
      makeInclude(),
      [["uuid-1"]],
      makeCtx({ namespace: "other" }),
    );

    // foreign entity's namespace takes precedence
    expect(result.text).toContain('"content"."Author"');
    expect(result).toMatchSnapshot();
  });

  test("falls back to ctx.namespace when foreignMeta has no namespace", () => {
    const relation = makeRelation({
      type: "ManyToOne",
      joinKeys: { authorId: "id" },
    });
    const foreignMeta = makeForeignMeta("Author", null);

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);

    const ctx = makeCtx({ namespace: "fallback_ns" });
    const result = compileRelationQuery(makeInclude(), [["uuid-1"]], ctx);

    expect(result.text).toContain('"fallback_ns"."Author"');
    expect(result).toMatchSnapshot();
  });

  test("handles composite joinKeys with multiple pk values", () => {
    const relation = makeRelation({
      type: "ManyToOne",
      joinKeys: { companyId: "companyId", userId: "userId" },
    });
    const foreignMeta: EntityMetadata = {
      ...makeForeignMeta("CompositeEntity"),
      fields: [
        makeField("companyId", { type: "uuid", name: "company_id" }),
        makeField("userId", { type: "uuid", name: "user_id" }),
      ],
    } as unknown as EntityMetadata;

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);

    const result = compileRelationQuery(
      makeInclude(),
      [
        ["company-1", "user-1"],
        ["company-2", "user-2"],
      ],
      makeCtx(),
    );

    expect(result.text).toContain("ROW(");
    expect(result.params).toEqual(["company-1", "user-1", "company-2", "user-2"]);
    expect(result).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// ManyToMany with joinTable
// ---------------------------------------------------------------------------

describe("compileRelationQuery — ManyToMany", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("compiles a basic ManyToMany query with INNER JOIN on join table", () => {
    const inverseRelation: MetaRelation = {
      key: "courses",
      foreignConstructor: () => class Course {},
      foreignKey: "students",
      findKeys: null,
      joinKeys: { courseId: "id" }, // join table col -> foreign PK
      joinTable: null,
      options: {} as any,
      orderBy: null,
      type: "ManyToMany",
    };

    const foreignMeta: EntityMetadata = {
      ...makeForeignMeta("Course"),
      fields: [makeField("id", { type: "uuid" }), makeField("name", { type: "string" })],
      relations: [inverseRelation],
      filters: [],
    } as unknown as EntityMetadata;

    const relation = makeRelation({
      type: "ManyToMany",
      key: "students",
      foreignKey: "courses",
      joinKeys: { studentId: "id" }, // joinTableCol: rootPKField
      joinTable: "course_student",
    });

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);

    const include = makeInclude({ relation: "students" });
    const result = compileRelationQuery(include, [["student-uuid-1"]], makeCtx());

    expect(result.text).toContain("INNER JOIN");
    expect(result.text).toContain('"course_student"');
    expect(result.text).toContain("__jt_");
    expect(result.params).toEqual(["student-uuid-1"]);
    expect(result).toMatchSnapshot();
  });

  test("includes join table root pk alias columns in SELECT", () => {
    const inverseRelation: MetaRelation = {
      key: "courses",
      foreignConstructor: () => class {},
      foreignKey: "students",
      findKeys: null,
      joinKeys: { courseId: "id" },
      joinTable: null,
      options: {} as any,
      orderBy: null,
      type: "ManyToMany",
    };

    const foreignMeta: EntityMetadata = {
      ...makeForeignMeta("Course"),
      fields: [makeField("id", { type: "uuid" }), makeField("name", { type: "string" })],
      relations: [inverseRelation],
      filters: [],
    } as unknown as EntityMetadata;

    const relation = makeRelation({
      type: "ManyToMany",
      key: "students",
      foreignKey: "courses",
      joinKeys: { studentId: "id" },
      joinTable: "course_student",
    });

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);

    const result = compileRelationQuery(makeInclude(), [["s-uuid-1"]], makeCtx());

    // Alias pattern: AS "__jt_{joinTableCol}"
    expect(result.text).toContain('"__jt_studentId"');
    expect(result).toMatchSnapshot();
  });

  test("uses findKeys when no inverse relation is found", () => {
    const foreignMeta: EntityMetadata = {
      ...makeForeignMeta("Tag"),
      fields: [makeField("id", { type: "uuid" }), makeField("label", { type: "string" })],
      relations: [], // no inverse relation
      filters: [],
    } as unknown as EntityMetadata;

    const relation = makeRelation({
      type: "ManyToMany",
      key: "tags",
      foreignKey: "articles",
      joinKeys: { articleId: "id" },
      joinTable: "article_tag",
      findKeys: { tagId: "id" }, // fallback when no inverse found
    });

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);

    const result = compileRelationQuery(
      makeInclude({ relation: "tags" }),
      [["article-1"]],
      makeCtx(),
    );

    expect(result.text).toContain("INNER JOIN");
    expect(result).toMatchSnapshot();
  });

  test("applies orderBy with table alias f for ManyToMany", () => {
    const inverseRelation: MetaRelation = {
      key: "courses",
      foreignConstructor: () => class {},
      foreignKey: "students",
      findKeys: null,
      joinKeys: { courseId: "id" },
      joinTable: null,
      options: {} as any,
      orderBy: null,
      type: "ManyToMany",
    };

    const foreignMeta: EntityMetadata = {
      ...makeForeignMeta("Course"),
      fields: [makeField("id", { type: "uuid" }), makeField("name", { type: "string" })],
      relations: [inverseRelation],
      filters: [],
    } as unknown as EntityMetadata;

    const relation = makeRelation({
      type: "ManyToMany",
      key: "students",
      foreignKey: "courses",
      joinKeys: { studentId: "id" },
      joinTable: "course_student",
      orderBy: { name: "DESC" },
    });

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);

    const result = compileRelationQuery(makeInclude(), [["s-uuid"]], makeCtx());

    expect(result.text).toContain('ORDER BY "f"."name" DESC');
    expect(result).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// Version filtering
// ---------------------------------------------------------------------------

describe("compileRelationQuery — version filtering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("adds versionEndDate IS NULL when foreignMeta has version fields and no timestamp", () => {
    const foreignMeta: EntityMetadata = {
      ...makeForeignMeta("VersionedPost"),
      fields: [
        makeField("id", { type: "uuid" }),
        makeField("title", { type: "string" }),
        makeField("authorId", { type: "uuid", name: "author_id" }),
        makeField("versionStartDate", {
          type: "timestamp",
          name: "version_start_date",
          decorator: "VersionStartDate",
        }),
        makeField("versionEndDate", {
          type: "timestamp",
          name: "version_end_date",
          decorator: "VersionEndDate",
          nullable: true,
        }),
      ],
      filters: [],
    } as unknown as EntityMetadata;

    const relation = makeRelation({ findKeys: { authorId: "id" } });

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);

    const ctx = makeCtx({ versionTimestamp: null });
    const result = compileRelationQuery(makeInclude(), [["uuid-1"]], ctx);

    expect(result.text).toContain('"version_end_date" IS NULL');
    expect(result).toMatchSnapshot();
  });

  test("adds point-in-time version condition when versionTimestamp is set", () => {
    const ts = new Date("2025-01-15T12:00:00Z");

    const foreignMeta: EntityMetadata = {
      ...makeForeignMeta("VersionedPost"),
      fields: [
        makeField("id", { type: "uuid" }),
        makeField("title", { type: "string" }),
        makeField("authorId", { type: "uuid", name: "author_id" }),
        makeField("versionStartDate", {
          type: "timestamp",
          name: "version_start_date",
          decorator: "VersionStartDate",
        }),
        makeField("versionEndDate", {
          type: "timestamp",
          name: "version_end_date",
          decorator: "VersionEndDate",
          nullable: true,
        }),
      ],
      filters: [],
    } as unknown as EntityMetadata;

    const relation = makeRelation({ findKeys: { authorId: "id" } });

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);

    const ctx = makeCtx({ versionTimestamp: ts });
    const result = compileRelationQuery(makeInclude(), [["uuid-1"]], ctx);

    expect(result.params).toContain(ts);
    expect(result.text).toContain("<=");
    expect(result).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// User-provided WHERE filter
// ---------------------------------------------------------------------------

describe("compileRelationQuery — user-provided WHERE", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("appends compiled user WHERE condition to the query", () => {
    const relation = makeRelation({ findKeys: { authorId: "id" } });
    const foreignMeta = makeForeignMeta();

    mockFindRelationByKey.mockReturnValue(relation);
    mockGetRelationMetadata.mockReturnValue(foreignMeta);

    const include = makeInclude({ where: { title: "Hello World" } });
    const result = compileRelationQuery(include, [["uuid-1"]], makeCtx());

    expect(result.text).toContain("AND");
    expect(result.params).toContain("Hello World");
    expect(result).toMatchSnapshot();
  });
});
