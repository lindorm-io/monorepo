import type { MysqlQueryClient, MysqlQueryResult } from "../../types/mysql-query-client";
import { introspectSchema } from "./introspect-schema";
import { describe, expect, test, vi } from "vitest";

const createMockClient = (
  responses: Record<string, Array<Record<string, unknown>>>,
): MysqlQueryClient => ({
  query: vi.fn(async (sql: string, _params?: Array<unknown>) => {
    const trimmed = sql.trim().toUpperCase();

    for (const [key, rows] of Object.entries(responses)) {
      if (trimmed.includes(key.toUpperCase())) {
        return { rows, rowCount: rows.length, insertId: 0 };
      }
    }

    return { rows: [], rowCount: 0, insertId: 0 };
  }) as MysqlQueryClient["query"],
});

describe("introspectSchema (MySQL)", () => {
  test("returns empty snapshot when no tables exist", async () => {
    const client = createMockClient({
      "INFORMATION_SCHEMA.TABLES": [],
    });

    const snapshot = await introspectSchema(client);

    expect(snapshot.tables.size).toBe(0);
  });

  test("introspects tables with columns", async () => {
    const client = createMockClient({
      "INFORMATION_SCHEMA.TABLES": [{ TABLE_NAME: "users" }],
      "INFORMATION_SCHEMA.COLUMNS": [
        {
          TABLE_NAME: "users",
          COLUMN_NAME: "id",
          DATA_TYPE: "char",
          COLUMN_TYPE: "char(36)",
          IS_NULLABLE: "NO",
          COLUMN_DEFAULT: null,
          CHARACTER_MAXIMUM_LENGTH: 36,
          NUMERIC_PRECISION: null,
          NUMERIC_SCALE: null,
          EXTRA: "",
          ORDINAL_POSITION: 1,
        },
        {
          TABLE_NAME: "users",
          COLUMN_NAME: "name",
          DATA_TYPE: "varchar",
          COLUMN_TYPE: "varchar(255)",
          IS_NULLABLE: "YES",
          COLUMN_DEFAULT: null,
          CHARACTER_MAXIMUM_LENGTH: 255,
          NUMERIC_PRECISION: null,
          NUMERIC_SCALE: null,
          EXTRA: "",
          ORDINAL_POSITION: 2,
        },
      ],
      "INFORMATION_SCHEMA.STATISTICS": [],
      "TABLE_CONSTRAINTS tc": [],
      "CHECK_CONSTRAINTS cc": [],
    });

    const snapshot = await introspectSchema(client);

    expect(snapshot.tables.size).toBe(1);
    expect(snapshot).toMatchSnapshot();
  });

  test("respects managedTableNames filter", async () => {
    const client = createMockClient({
      "INFORMATION_SCHEMA.TABLES": [
        { TABLE_NAME: "users" },
        { TABLE_NAME: "posts" },
        { TABLE_NAME: "unmanaged" },
      ],
      "INFORMATION_SCHEMA.COLUMNS": [
        {
          TABLE_NAME: "users",
          COLUMN_NAME: "id",
          DATA_TYPE: "char",
          COLUMN_TYPE: "char(36)",
          IS_NULLABLE: "NO",
          COLUMN_DEFAULT: null,
          CHARACTER_MAXIMUM_LENGTH: 36,
          NUMERIC_PRECISION: null,
          NUMERIC_SCALE: null,
          EXTRA: "",
          ORDINAL_POSITION: 1,
        },
      ],
      "INFORMATION_SCHEMA.STATISTICS": [],
      "TABLE_CONSTRAINTS tc": [],
      "CHECK_CONSTRAINTS cc": [],
    });

    const snapshot = await introspectSchema(client, ["users"]);

    expect(snapshot.tables.size).toBe(1);
    expect(snapshot.tables.has("users")).toBe(true);
    expect(snapshot.tables.has("posts")).toBe(false);
  });

  test("introspects indexes", async () => {
    const client = createMockClient({
      "INFORMATION_SCHEMA.TABLES": [{ TABLE_NAME: "users" }],
      "INFORMATION_SCHEMA.COLUMNS": [],
      "INFORMATION_SCHEMA.STATISTICS": [
        {
          INDEX_NAME: "idx_name",
          TABLE_NAME: "users",
          COLUMN_NAME: "name",
          NON_UNIQUE: 1,
          SEQ_IN_INDEX: 1,
          INDEX_TYPE: "BTREE",
          SUB_PART: null,
          COLLATION: "A",
        },
      ],
      "TABLE_CONSTRAINTS tc": [],
      "CHECK_CONSTRAINTS cc": [],
    });

    const snapshot = await introspectSchema(client);
    const table = snapshot.tables.get("users")!;

    expect(table.indexes).toHaveLength(1);
    expect(table.indexes[0]).toMatchSnapshot();
  });

  test("introspects check constraints", async () => {
    const client = createMockClient({
      "INFORMATION_SCHEMA.TABLES": [{ TABLE_NAME: "users" }],
      "INFORMATION_SCHEMA.COLUMNS": [
        {
          TABLE_NAME: "users",
          COLUMN_NAME: "id",
          DATA_TYPE: "char",
          COLUMN_TYPE: "char(36)",
          IS_NULLABLE: "NO",
          COLUMN_DEFAULT: null,
          CHARACTER_MAXIMUM_LENGTH: 36,
          NUMERIC_PRECISION: null,
          NUMERIC_SCALE: null,
          EXTRA: "",
          ORDINAL_POSITION: 1,
        },
        {
          TABLE_NAME: "users",
          COLUMN_NAME: "age",
          DATA_TYPE: "int",
          COLUMN_TYPE: "int",
          IS_NULLABLE: "NO",
          COLUMN_DEFAULT: null,
          CHARACTER_MAXIMUM_LENGTH: null,
          NUMERIC_PRECISION: 10,
          NUMERIC_SCALE: 0,
          EXTRA: "",
          ORDINAL_POSITION: 2,
        },
      ],
      "INFORMATION_SCHEMA.STATISTICS": [],
      "CONSTRAINT_TYPE = 'FOREIGN KEY'": [],
      "CONSTRAINT_TYPE = 'UNIQUE'": [],
      "CHECK_CONSTRAINTS cc": [
        {
          CONSTRAINT_NAME: "chk_age_positive",
          CHECK_CLAUSE: "`age` >= 0",
          TABLE_NAME: "users",
        },
        {
          CONSTRAINT_NAME: "chk_age_max",
          CHECK_CLAUSE: "`age` < 200",
          TABLE_NAME: "users",
        },
      ],
    });

    const snapshot = await introspectSchema(client);
    const table = snapshot.tables.get("users")!;

    expect(table.checkConstraints).toHaveLength(2);
    expect(table.checkConstraints).toMatchSnapshot();
  });

  test("introspects unique constraints", async () => {
    // Key ordering matters: the unique query SQL contains a LEFT JOIN to
    // information_schema.STATISTICS, so the STATISTICS key must come after
    // the UNIQUE key to avoid premature matching.
    const client = createMockClient({
      "INFORMATION_SCHEMA.TABLES": [{ TABLE_NAME: "users" }],
      "INFORMATION_SCHEMA.COLUMNS": [
        {
          TABLE_NAME: "users",
          COLUMN_NAME: "id",
          DATA_TYPE: "char",
          COLUMN_TYPE: "char(36)",
          IS_NULLABLE: "NO",
          COLUMN_DEFAULT: null,
          CHARACTER_MAXIMUM_LENGTH: 36,
          NUMERIC_PRECISION: null,
          NUMERIC_SCALE: null,
          EXTRA: "",
          ORDINAL_POSITION: 1,
        },
        {
          TABLE_NAME: "users",
          COLUMN_NAME: "email",
          DATA_TYPE: "varchar",
          COLUMN_TYPE: "varchar(320)",
          IS_NULLABLE: "NO",
          COLUMN_DEFAULT: null,
          CHARACTER_MAXIMUM_LENGTH: 320,
          NUMERIC_PRECISION: null,
          NUMERIC_SCALE: null,
          EXTRA: "",
          ORDINAL_POSITION: 2,
        },
      ],
      "CONSTRAINT_TYPE = 'FOREIGN KEY'": [],
      "CONSTRAINT_TYPE = 'UNIQUE'": [
        {
          CONSTRAINT_NAME: "uq_email",
          TABLE_NAME: "users",
          COLUMN_NAME: "email",
          ORDINAL_POSITION: 1,
          SUB_PART: null,
        },
      ],
      "CHECK_CONSTRAINTS cc": [],
      "INDEX_NAME != 'PRIMARY'": [],
    });

    const snapshot = await introspectSchema(client);
    const table = snapshot.tables.get("users")!;

    expect(table.uniqueConstraints).toHaveLength(1);
    expect(table.uniqueConstraints).toMatchSnapshot();
  });

  test("introspects composite unique constraints", async () => {
    const client = createMockClient({
      "INFORMATION_SCHEMA.TABLES": [{ TABLE_NAME: "users" }],
      "INFORMATION_SCHEMA.COLUMNS": [],
      "CONSTRAINT_TYPE = 'FOREIGN KEY'": [],
      "CONSTRAINT_TYPE = 'UNIQUE'": [
        {
          CONSTRAINT_NAME: "uq_tenant_email",
          TABLE_NAME: "users",
          COLUMN_NAME: "tenant_id",
          ORDINAL_POSITION: 1,
          SUB_PART: null,
        },
        {
          CONSTRAINT_NAME: "uq_tenant_email",
          TABLE_NAME: "users",
          COLUMN_NAME: "email",
          ORDINAL_POSITION: 2,
          SUB_PART: 191,
        },
      ],
      "CHECK_CONSTRAINTS cc": [],
      "INDEX_NAME != 'PRIMARY'": [],
    });

    const snapshot = await introspectSchema(client);
    const table = snapshot.tables.get("users")!;

    expect(table.uniqueConstraints).toHaveLength(1);
    expect(table.uniqueConstraints[0].columns).toHaveLength(2);
    expect(table.uniqueConstraints).toMatchSnapshot();
  });

  test("introspects foreign keys", async () => {
    const client = createMockClient({
      "INFORMATION_SCHEMA.TABLES": [{ TABLE_NAME: "posts" }],
      "INFORMATION_SCHEMA.COLUMNS": [],
      "INFORMATION_SCHEMA.STATISTICS": [],
      "CONSTRAINT_TYPE = 'FOREIGN KEY'": [
        {
          CONSTRAINT_NAME: "fk_posts_author",
          TABLE_NAME: "posts",
          COLUMN_NAME: "author_id",
          REFERENCED_TABLE_NAME: "users",
          REFERENCED_COLUMN_NAME: "id",
          DELETE_RULE: "CASCADE",
          UPDATE_RULE: "CASCADE",
        },
      ],
      "CONSTRAINT_TYPE = 'UNIQUE'": [],
      "CHECK_CONSTRAINTS cc": [],
    });

    const snapshot = await introspectSchema(client);
    const table = snapshot.tables.get("posts")!;

    expect(table.foreignKeys).toHaveLength(1);
    expect(table.foreignKeys[0]).toMatchSnapshot();
  });
});
