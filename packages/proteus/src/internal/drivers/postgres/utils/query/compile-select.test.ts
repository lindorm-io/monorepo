import { makeField } from "../../../../__fixtures__/make-field";
import type { EntityMetadata, MetaRelation } from "../../../../entity/types/metadata";
import type { IncludeSpec, WindowSpec } from "../../../../types/query";
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type Mock,
  type MockedFunction,
} from "vitest";

// Mock get-relation-metadata so tests for buildAliasMap / compileSelect with includes
// do not need a real decorator-decorated entity class registered in getEntityMetadata.
vi.mock("./get-relation-metadata");

import { findRelationByKey, getRelationMetadata } from "./get-relation-metadata";
import { buildAliasMap, compileFrom, compileSelect } from "./compile-select";

const mockFindRelationByKey = findRelationByKey as MockedFunction<
  typeof findRelationByKey
>;
const mockGetRelationMetadata = getRelationMetadata as MockedFunction<
  typeof getRelationMetadata
>;

const metadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "users",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("email", { type: "string", name: "email_address" }),
    makeField("age", { type: "integer" }),
    makeField("department", { type: "string", name: "dept_code" }),
  ],
  relations: [],
} as unknown as EntityMetadata;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildAliasMap", () => {
  test("should create root alias for entity with no includes", () => {
    const { aliasMap } = buildAliasMap(metadata, []);
    expect(aliasMap).toMatchSnapshot();
  });
});

describe("compileSelect", () => {
  test("should compile all fields", () => {
    const { aliasMap } = buildAliasMap(metadata, []);
    const result = compileSelect(metadata, aliasMap, null, [], false);
    expect(result).toMatchSnapshot();
  });

  test("should compile selected fields only", () => {
    const { aliasMap } = buildAliasMap(metadata, []);
    const result = compileSelect(metadata, aliasMap, ["id", "name"], [], false);
    expect(result).toMatchSnapshot();
  });

  test("should compile with DISTINCT", () => {
    const { aliasMap } = buildAliasMap(metadata, []);
    const result = compileSelect(metadata, aliasMap, null, [], true);
    expect(result).toContain("DISTINCT");
  });
});

describe("compileSelect — window functions", () => {
  test("should compile ROW_NUMBER with partitionBy and orderBy", () => {
    const { aliasMap } = buildAliasMap(metadata, []);
    const params: Array<unknown> = [];
    const windows: Array<WindowSpec<any>> = [
      {
        fn: "ROW_NUMBER",
        partitionBy: ["department"],
        orderBy: { age: "DESC" },
        alias: "row_num",
      },
    ];
    const result = compileSelect(
      metadata,
      aliasMap,
      null,
      [],
      false,
      undefined,
      windows,
      params,
    );
    expect(result).toMatchSnapshot();
  });

  test("should compile NTILE with numeric arg", () => {
    const { aliasMap } = buildAliasMap(metadata, []);
    const params: Array<unknown> = [];
    const windows: Array<WindowSpec<any>> = [
      {
        fn: "NTILE",
        args: [4],
        orderBy: { age: "ASC" },
        alias: "quartile",
      },
    ];
    const result = compileSelect(
      metadata,
      aliasMap,
      null,
      [],
      false,
      undefined,
      windows,
      params,
    );
    expect(result).toMatchSnapshot();
  });

  test("should compile LAG with column arg", () => {
    const { aliasMap } = buildAliasMap(metadata, []);
    const params: Array<unknown> = [];
    const windows: Array<WindowSpec<any>> = [
      {
        fn: "LAG",
        args: ["age", 1],
        orderBy: { name: "ASC" },
        alias: "prev_age",
      },
    ];
    const result = compileSelect(
      metadata,
      aliasMap,
      null,
      [],
      false,
      undefined,
      windows,
      params,
    );
    expect(result).toMatchSnapshot();
  });

  test("should compile SUM with partitionBy only (no orderBy)", () => {
    const { aliasMap } = buildAliasMap(metadata, []);
    const params: Array<unknown> = [];
    const windows: Array<WindowSpec<any>> = [
      {
        fn: "SUM",
        args: ["age"],
        partitionBy: ["department"],
        alias: "dept_total",
      },
    ];
    const result = compileSelect(
      metadata,
      aliasMap,
      null,
      [],
      false,
      undefined,
      windows,
      params,
    );
    expect(result).toMatchSnapshot();
  });

  test("should compile RANK with no args and empty OVER", () => {
    const { aliasMap } = buildAliasMap(metadata, []);
    const params: Array<unknown> = [];
    const windows: Array<WindowSpec<any>> = [
      {
        fn: "RANK",
        orderBy: { age: "DESC" },
        alias: "rank",
      },
    ];
    const result = compileSelect(
      metadata,
      aliasMap,
      null,
      [],
      false,
      undefined,
      windows,
      params,
    );
    expect(result).toMatchSnapshot();
  });

  test("should compile multiple window functions", () => {
    const { aliasMap } = buildAliasMap(metadata, []);
    const params: Array<unknown> = [];
    const windows: Array<WindowSpec<any>> = [
      {
        fn: "ROW_NUMBER",
        orderBy: { name: "ASC" },
        alias: "rn",
      },
      {
        fn: "DENSE_RANK",
        partitionBy: ["department"],
        orderBy: { age: "DESC" },
        alias: "dr",
      },
    ];
    const result = compileSelect(
      metadata,
      aliasMap,
      null,
      [],
      false,
      undefined,
      windows,
      params,
    );
    expect(result).toMatchSnapshot();
  });

  test("should resolve custom column name in window function", () => {
    const { aliasMap } = buildAliasMap(metadata, []);
    const params: Array<unknown> = [];
    const windows: Array<WindowSpec<any>> = [
      {
        fn: "COUNT",
        args: ["email"],
        partitionBy: ["department"],
        alias: "email_count",
      },
    ];
    const result = compileSelect(
      metadata,
      aliasMap,
      null,
      [],
      false,
      undefined,
      windows,
      params,
    );
    // email field has name "email_address", department has name "dept_code"
    expect(result).toContain("email_address");
    expect(result).toContain("dept_code");
    expect(result).toMatchSnapshot();
  });
});

describe("compileSelect — raw selections", () => {
  test("should compile raw selection with params", () => {
    const { aliasMap } = buildAliasMap(metadata, []);
    const params: Array<unknown> = [];
    const rawSelections = [
      {
        expression: "COALESCE($1, $2)",
        alias: "safe_name",
        params: ["default", "fallback"],
      },
    ];
    const result = compileSelect(
      metadata,
      aliasMap,
      null,
      [],
      false,
      rawSelections,
      undefined,
      params,
    );
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["default", "fallback"]);
  });
});

describe("compileFrom", () => {
  test("should compile schema-qualified FROM clause", () => {
    const { aliasMap } = buildAliasMap(metadata, []);
    const result = compileFrom(aliasMap);
    expect(result).toMatchSnapshot();
  });

  test("should compile unqualified FROM clause", () => {
    const noSchemaMeta = {
      ...metadata,
      entity: { ...metadata.entity, namespace: null },
    } as EntityMetadata;
    const { aliasMap } = buildAliasMap(noSchemaMeta, []);
    const result = compileFrom(aliasMap);
    expect(result).toMatchSnapshot();
  });

  test("should compile FROM with cteFrom using aliasMap root", () => {
    const { aliasMap } = buildAliasMap(metadata, []);
    const result = compileFrom(aliasMap, "my_cte");
    expect(result).toMatchSnapshot();
    expect(result).toContain('"my_cte"');
    expect(result).toContain('"t0"');
  });
});

// ---------------------------------------------------------------------------
// T07 — buildAliasMap with ManyToMany includes
// ---------------------------------------------------------------------------

describe("buildAliasMap — ManyToMany includes", () => {
  // Metadata for the foreign (tag) entity that the M2M relation points to
  const tagMeta = {
    entity: {
      decorator: "Entity",
      cache: null,
      comment: null,
      database: null,
      name: "tags",
      namespace: "app",
    },
    fields: [makeField("id", { type: "uuid" }), makeField("label", { type: "string" })],
    relations: [],
  } as unknown as EntityMetadata;

  // A ManyToMany relation on the root entity (users → tags through users_x_tags join table)
  const m2mRelation: MetaRelation = {
    key: "tags",
    foreignConstructor: () => class Tags {},
    foreignKey: "id",
    findKeys: { id: "tag_id" },
    joinKeys: { id: "user_id" },
    joinTable: "users_x_tags",
    type: "ManyToMany",
    options: {} as any,
    orderBy: null,
  } as MetaRelation;

  // Root metadata with the M2M relation declared
  const rootWithM2M = {
    ...metadata,
    relations: [m2mRelation],
  } as unknown as EntityMetadata;

  test("should produce 3 alias entries — root (t0), join table (t1, __join suffix), and target (t2)", () => {
    // findRelationByKey returns our M2M relation; getRelationMetadata returns tag metadata
    mockFindRelationByKey.mockReturnValue(m2mRelation);
    mockGetRelationMetadata.mockReturnValue(tagMeta);

    const includes: Array<IncludeSpec> = [
      { relation: "tags", required: false, strategy: "join", select: null, where: null },
    ];

    const { aliasMap } = buildAliasMap(rootWithM2M, includes);

    expect(aliasMap).toHaveLength(3);
    expect(aliasMap[0].tableAlias).toBe("t0");
    expect(aliasMap[0].relationKey).toBeNull();
    expect(aliasMap[1].tableAlias).toBe("t1");
    expect(aliasMap[1].relationKey).toBe("tags__join");
    expect(aliasMap[1].tableName).toBe("users_x_tags");
    expect(aliasMap[2].tableAlias).toBe("t2");
    expect(aliasMap[2].relationKey).toBe("tags");
    expect(aliasMap[2].tableName).toBe("tags");
    expect(aliasMap).toMatchSnapshot();
  });

  test("join table alias entry carries root metadata (no dedicated join-table entity)", () => {
    mockFindRelationByKey.mockReturnValue(m2mRelation);
    mockGetRelationMetadata.mockReturnValue(tagMeta);

    const includes: Array<IncludeSpec> = [
      { relation: "tags", required: false, strategy: "join", select: null, where: null },
    ];

    const { aliasMap } = buildAliasMap(rootWithM2M, includes);

    // The join table alias (index 1) reuses the root entity's metadata because
    // join tables don't have their own EntityMetadata
    expect(aliasMap[1].metadata).toBe(rootWithM2M);
  });

  test("target alias entry carries the foreign entity metadata", () => {
    mockFindRelationByKey.mockReturnValue(m2mRelation);
    mockGetRelationMetadata.mockReturnValue(tagMeta);

    const includes: Array<IncludeSpec> = [
      { relation: "tags", required: false, strategy: "join", select: null, where: null },
    ];

    const { aliasMap } = buildAliasMap(rootWithM2M, includes);

    expect(aliasMap[2].metadata).toBe(tagMeta);
  });

  test("should use defaultNamespace for join table when root entity has no namespace", () => {
    const noNsMeta = {
      ...metadata,
      entity: { ...metadata.entity, namespace: null },
      relations: [m2mRelation],
    } as unknown as EntityMetadata;

    mockFindRelationByKey.mockReturnValue(m2mRelation);
    mockGetRelationMetadata.mockReturnValue(tagMeta);

    const includes: Array<IncludeSpec> = [
      { relation: "tags", required: false, strategy: "join", select: null, where: null },
    ];

    const { aliasMap } = buildAliasMap(noNsMeta, includes, "default_schema");

    // Both the join table and the root should pick up defaultNamespace
    expect(aliasMap[0].schema).toBe("default_schema");
    expect(aliasMap[1].schema).toBe("default_schema");
  });
});

// ---------------------------------------------------------------------------
// T08 — compileSelect: FK column injection from owning-side joinKeys
// ---------------------------------------------------------------------------

describe("compileSelect — FK column injection from ManyToOne joinKeys", () => {
  // Root metadata: userId field is NOT included in the fields list (simulates a bare FK column
  // that has no @Field decorator but is the owning side of a ManyToOne relation)
  const metaWithFk = {
    entity: {
      decorator: "Entity",
      cache: null,
      comment: null,
      database: null,
      name: "posts",
      namespace: "app",
    },
    fields: [makeField("id", { type: "uuid" }), makeField("title", { type: "string" })],
    relations: [
      {
        key: "user",
        foreignConstructor: () => class User {},
        foreignKey: "id",
        findKeys: null,
        // joinKeys: localCol → foreignCol; "user_id" is the FK column in the posts table
        joinKeys: { user_id: "id" },
        joinTable: null,
        type: "ManyToOne",
        options: {} as any,
        orderBy: null,
      } as unknown as MetaRelation,
    ],
  } as unknown as EntityMetadata;

  test("should inject FK column (user_id) that is absent from fields list", () => {
    const { aliasMap } = buildAliasMap(metaWithFk, []);
    const result = compileSelect(metaWithFk, aliasMap, null, [], false);

    // user_id is not a declared field, but should appear as a SELECT column
    expect(result).toContain('"user_id"');
    expect(result).toContain('"t0_user_id"');
    expect(result).toMatchSnapshot();
  });

  test("should NOT duplicate FK column when it is already declared as a field", () => {
    // user_id IS in the fields list — should appear exactly once
    const metaWithFkAsField = {
      ...metaWithFk,
      fields: [
        makeField("id", { type: "uuid" }),
        makeField("title", { type: "string" }),
        makeField("user_id", { type: "uuid" }),
      ],
    } as unknown as EntityMetadata;

    const { aliasMap } = buildAliasMap(metaWithFkAsField, []);
    const result = compileSelect(metaWithFkAsField, aliasMap, null, [], false);

    // user_id appears once from fields; the FK injection path is skipped
    const occurrences = (result.match(/"user_id"/g) ?? []).length;
    expect(occurrences).toBe(1);
    expect(result).toMatchSnapshot();
  });

  test("should skip FK injection for ManyToMany relations (type guard)", () => {
    const metaWithM2M = {
      ...metaWithFk,
      relations: [
        {
          ...metaWithFk.relations[0],
          type: "ManyToMany",
          joinTable: "users_x_posts",
        } as unknown as MetaRelation,
      ],
    } as unknown as EntityMetadata;

    const { aliasMap } = buildAliasMap(metaWithM2M, []);
    const result = compileSelect(metaWithM2M, aliasMap, null, [], false);

    // ManyToMany joinKeys are not injected into SELECT
    expect(result).not.toContain('"user_id"');
    expect(result).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// T09 — compileSelect: non-empty includes emit foreign entity columns
// ---------------------------------------------------------------------------

describe("compileSelect — non-empty includes", () => {
  // Foreign entity metadata
  const tagMeta = {
    entity: {
      decorator: "Entity",
      cache: null,
      comment: null,
      database: null,
      name: "tags",
      namespace: "app",
    },
    fields: [
      makeField("id", { type: "uuid" }),
      makeField("label", { type: "string" }),
      makeField("active", { type: "boolean" }),
    ],
    relations: [],
  } as unknown as EntityMetadata;

  const m2oRelation: MetaRelation = {
    key: "tags",
    foreignConstructor: () => class Tags {},
    foreignKey: "id",
    findKeys: { tagId: "id" },
    joinKeys: { tag_id: "id" },
    joinTable: null,
    type: "ManyToOne",
    options: {} as any,
    orderBy: null,
  } as MetaRelation;

  const rootWithRelation = {
    ...metadata,
    relations: [m2oRelation],
  } as unknown as EntityMetadata;

  test("should include all foreign entity columns with the target alias prefix", () => {
    mockFindRelationByKey.mockReturnValue(m2oRelation);
    mockGetRelationMetadata.mockReturnValue(tagMeta);

    const includes: Array<IncludeSpec> = [
      { relation: "tags", required: false, strategy: "join", select: null, where: null },
    ];

    // Build the alias map (counter: t0 = root, t1 = tags — non-M2M so no join table entry)
    const { aliasMap } = buildAliasMap(rootWithRelation, includes);
    const result = compileSelect(rootWithRelation, aliasMap, null, includes, false);

    // Root columns with t0_ prefix
    expect(result).toContain('"t0"."id" AS "t0_id"');
    // Foreign entity columns with t1_ prefix
    expect(result).toContain('"t1"."id" AS "t1_id"');
    expect(result).toContain('"t1"."label" AS "t1_label"');
    expect(result).toContain('"t1"."active" AS "t1_active"');
    expect(result).toMatchSnapshot();
  });

  test("should honour include.select and emit only the specified foreign fields", () => {
    mockFindRelationByKey.mockReturnValue(m2oRelation);
    mockGetRelationMetadata.mockReturnValue(tagMeta);

    const includes: Array<IncludeSpec> = [
      {
        relation: "tags",
        required: false,
        strategy: "join",
        select: ["id", "label"],
        where: null,
      },
    ];

    const { aliasMap } = buildAliasMap(rootWithRelation, includes);
    const result = compileSelect(rootWithRelation, aliasMap, null, includes, false);

    expect(result).toContain('"t1"."id" AS "t1_id"');
    expect(result).toContain('"t1"."label" AS "t1_label"');
    // active was not in include.select — must be absent
    expect(result).not.toContain('"t1"."active"');
    expect(result).toMatchSnapshot();
  });

  test("should emit columns from multiple included relations with distinct alias prefixes", () => {
    // Second relation — profile
    const profileMeta = {
      entity: {
        decorator: "Entity",
        cache: null,
        comment: null,
        database: null,
        name: "profiles",
        namespace: "app",
      },
      fields: [makeField("id", { type: "uuid" }), makeField("bio", { type: "string" })],
      relations: [],
    } as unknown as EntityMetadata;

    const profileRelation: MetaRelation = {
      key: "profile",
      foreignConstructor: () => class Profile {},
      foreignKey: "userId",
      findKeys: { userId: "id" },
      joinKeys: null,
      joinTable: null,
      type: "OneToOne",
      options: {} as any,
      orderBy: null,
    } as MetaRelation;

    const rootWithTwoRelations = {
      ...metadata,
      relations: [m2oRelation, profileRelation],
    } as unknown as EntityMetadata;

    mockFindRelationByKey
      .mockReturnValueOnce(m2oRelation) // first include: tags
      .mockReturnValueOnce(profileRelation) // second include: profile (alias map)
      .mockReturnValueOnce(m2oRelation) // compileSelect re-calls for first include
      .mockReturnValueOnce(profileRelation); // compileSelect re-calls for second include
    mockGetRelationMetadata
      .mockReturnValueOnce(tagMeta) // alias map: tags foreign meta
      .mockReturnValueOnce(profileMeta) // alias map: profile foreign meta
      .mockReturnValueOnce(tagMeta) // compileSelect: tags foreign meta
      .mockReturnValueOnce(profileMeta); // compileSelect: profile foreign meta

    const includes: Array<IncludeSpec> = [
      { relation: "tags", required: false, strategy: "join", select: null, where: null },
      {
        relation: "profile",
        required: false,
        strategy: "join",
        select: null,
        where: null,
      },
    ];

    const { aliasMap } = buildAliasMap(rootWithTwoRelations, includes);
    const result = compileSelect(rootWithTwoRelations, aliasMap, null, includes, false);

    // tags is t1, profile is t2
    expect(result).toContain('"t1"."label" AS "t1_label"');
    expect(result).toContain('"t2"."bio" AS "t2_bio"');
    expect(result).toMatchSnapshot();
  });
});
