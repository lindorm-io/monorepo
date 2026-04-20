import type { PostgresQueryClient } from "../../types/postgres-query-client";
import { introspectSchema } from "./introspect-schema";
import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";

vi.mock("./introspect-tables", () => ({
  introspectTables: vi.fn(),
}));
vi.mock("./introspect-constraints", () => ({
  introspectConstraints: vi.fn(),
}));
vi.mock("./introspect-indexes", () => ({
  introspectIndexes: vi.fn(),
}));
vi.mock("./introspect-enums", () => ({
  introspectEnums: vi.fn(),
}));
vi.mock("./introspect-comments", () => ({
  introspectComments: vi.fn(),
}));

import { introspectComments } from "../../../../drivers/postgres/utils/sync/introspect-comments";
import { introspectConstraints } from "../../../../drivers/postgres/utils/sync/introspect-constraints";
import { introspectEnums } from "../../../../drivers/postgres/utils/sync/introspect-enums";
import { introspectIndexes } from "../../../../drivers/postgres/utils/sync/introspect-indexes";
import { introspectTables } from "./introspect-tables";

const mockIntrospectTables = introspectTables as MockedFunction<typeof introspectTables>;
const mockIntrospectConstraints = introspectConstraints as MockedFunction<
  typeof introspectConstraints
>;
const mockIntrospectIndexes = introspectIndexes as MockedFunction<
  typeof introspectIndexes
>;
const mockIntrospectEnums = introspectEnums as MockedFunction<typeof introspectEnums>;
const mockIntrospectComments = introspectComments as MockedFunction<
  typeof introspectComments
>;

const createMockClient = (): PostgresQueryClient => ({
  query: vi.fn().mockResolvedValue({ rows: [{ nspname: "public" }], rowCount: 1 }),
});

describe("introspectSchema", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty snapshot for no managed tables", async () => {
    const client = createMockClient();
    const result = await introspectSchema(client, []);
    expect(result).toEqual({ tables: [], enums: [], schemas: [] });
  });

  it("should call all sub-introspectors in parallel", async () => {
    const client = createMockClient();

    mockIntrospectTables.mockResolvedValue([
      {
        schema: "public",
        name: "users",
        columns: [
          {
            name: "id",
            type: "uuid",
            nullable: false,
            defaultExpr: null,
            isIdentity: false,
            identityGeneration: null,
            isGenerated: false,
            generationExpr: null,
            collation: null,
          },
        ],
        constraints: [],
        indexes: [],
        comment: null,
        columnComments: {},
        triggers: [],
      },
    ]);
    mockIntrospectConstraints.mockResolvedValue([]);
    mockIntrospectIndexes.mockResolvedValue([]);
    mockIntrospectEnums.mockResolvedValue([]);
    mockIntrospectComments.mockResolvedValue([]);

    const result = await introspectSchema(client, [{ schema: "public", name: "users" }]);

    expect(mockIntrospectTables).toHaveBeenCalledWith(client, ["public"], ["users"]);
    expect(mockIntrospectConstraints).toHaveBeenCalledWith(client, ["public"], ["users"]);
    expect(mockIntrospectIndexes).toHaveBeenCalledWith(client, ["public"], ["users"]);
    expect(mockIntrospectEnums).toHaveBeenCalledWith(client, ["public"]);
    expect(mockIntrospectComments).toHaveBeenCalledWith(client, ["public"], ["users"]);
    expect(result).toMatchSnapshot();
  });

  it("should assemble constraints into tables", async () => {
    const client = createMockClient();

    mockIntrospectTables.mockResolvedValue([
      {
        schema: "public",
        name: "users",
        columns: [
          {
            name: "id",
            type: "uuid",
            nullable: false,
            defaultExpr: null,
            isIdentity: false,
            identityGeneration: null,
            isGenerated: false,
            generationExpr: null,
            collation: null,
          },
        ],
        constraints: [],
        indexes: [],
        comment: null,
        columnComments: {},
        triggers: [],
      },
    ]);
    mockIntrospectConstraints.mockResolvedValue([
      {
        schema: "public",
        table: "users",
        constraint: {
          name: "users_pkey",
          type: "PRIMARY KEY" as const,
          columns: ["id"],
          foreignSchema: null,
          foreignTable: null,
          foreignColumns: null,
          onDelete: null,
          onUpdate: null,
          checkExpr: null,
          deferrable: false,
          initiallyDeferred: false,
        },
      },
    ]);
    mockIntrospectIndexes.mockResolvedValue([]);
    mockIntrospectEnums.mockResolvedValue([]);
    mockIntrospectComments.mockResolvedValue([]);

    const result = await introspectSchema(client, [{ schema: "public", name: "users" }]);
    expect(result.tables[0].constraints).toHaveLength(1);
    expect(result.tables[0].constraints[0].name).toBe("users_pkey");
  });

  it("should assemble indexes into tables", async () => {
    const client = createMockClient();

    mockIntrospectTables.mockResolvedValue([
      {
        schema: "public",
        name: "users",
        columns: [
          {
            name: "email",
            type: "text",
            nullable: true,
            defaultExpr: null,
            isIdentity: false,
            identityGeneration: null,
            isGenerated: false,
            generationExpr: null,
            collation: null,
          },
        ],
        constraints: [],
        indexes: [],
        comment: null,
        columnComments: {},
        triggers: [],
      },
    ]);
    mockIntrospectConstraints.mockResolvedValue([]);
    mockIntrospectIndexes.mockResolvedValue([
      {
        schema: "public",
        table: "users",
        index: {
          name: "idx_email",
          unique: false,
          columns: [{ name: "email", direction: "asc" as const }],
          method: "btree",
          where: null,
          include: [],
        },
      },
    ]);
    mockIntrospectEnums.mockResolvedValue([]);
    mockIntrospectComments.mockResolvedValue([]);

    const result = await introspectSchema(client, [{ schema: "public", name: "users" }]);
    expect(result.tables[0].indexes).toHaveLength(1);
    expect(result.tables[0].indexes[0].name).toBe("idx_email");
  });

  it("should assemble comments into tables", async () => {
    const client = createMockClient();

    mockIntrospectTables.mockResolvedValue([
      {
        schema: "public",
        name: "users",
        columns: [
          {
            name: "id",
            type: "uuid",
            nullable: false,
            defaultExpr: null,
            isIdentity: false,
            identityGeneration: null,
            isGenerated: false,
            generationExpr: null,
            collation: null,
          },
        ],
        constraints: [],
        indexes: [],
        comment: null,
        columnComments: {},
        triggers: [],
      },
    ]);
    mockIntrospectConstraints.mockResolvedValue([]);
    mockIntrospectIndexes.mockResolvedValue([]);
    mockIntrospectEnums.mockResolvedValue([]);
    mockIntrospectComments.mockResolvedValue([
      { schema: "public", table: "users", column: null, comment: "User accounts" },
      { schema: "public", table: "users", column: "id", comment: "Primary key" },
    ]);

    const result = await introspectSchema(client, [{ schema: "public", name: "users" }]);
    expect(result.tables[0].comment).toBe("User accounts");
    expect(result.tables[0].columnComments).toEqual({ id: "Primary key" });
  });

  it("should deduplicate schemas and tables from managed list", async () => {
    const client = createMockClient();

    mockIntrospectTables.mockResolvedValue([]);
    mockIntrospectConstraints.mockResolvedValue([]);
    mockIntrospectIndexes.mockResolvedValue([]);
    mockIntrospectEnums.mockResolvedValue([]);
    mockIntrospectComments.mockResolvedValue([]);

    await introspectSchema(client, [
      { schema: "public", name: "users" },
      { schema: "public", name: "posts" },
      { schema: "custom", name: "users" },
    ]);

    expect(mockIntrospectTables).toHaveBeenCalledWith(
      client,
      expect.arrayContaining(["public", "custom"]),
      expect.arrayContaining(["users", "posts"]),
    );
  });

  it("should include existing schemas from pg_namespace", async () => {
    const client: PostgresQueryClient = {
      query: vi.fn().mockResolvedValue({
        rows: [{ nspname: "public" }, { nspname: "custom" }],
        rowCount: 2,
      }),
    };

    mockIntrospectTables.mockResolvedValue([]);
    mockIntrospectConstraints.mockResolvedValue([]);
    mockIntrospectIndexes.mockResolvedValue([]);
    mockIntrospectEnums.mockResolvedValue([]);
    mockIntrospectComments.mockResolvedValue([]);

    const result = await introspectSchema(client, [
      { schema: "public", name: "users" },
      { schema: "custom", name: "items" },
    ]);

    expect(result.schemas).toEqual(["public", "custom"]);
  });
});
