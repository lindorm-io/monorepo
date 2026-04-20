import type { MysqlDesiredSchema } from "../../types/desired-schema";
import type { MysqlDbSnapshot } from "../../types/db-snapshot";
import { diffSchema } from "./diff-schema";
import { describe, expect, test } from "vitest";

const emptySnapshot = (): MysqlDbSnapshot => ({ tables: new Map() });

describe("diffSchema (MySQL)", () => {
  test("generates create_table for a new table", () => {
    const desired: MysqlDesiredSchema = {
      tables: [
        {
          name: "users",
          columns: [
            {
              name: "id",
              mysqlType: "char(36)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
            {
              name: "name",
              mysqlType: "varchar(255)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
          ],
          primaryKeys: ["id"],
          foreignKeys: [],
          uniqueConstraints: [],
          triggers: [],
          checkConstraints: [],
          indexes: [],
        },
      ],
    };

    const plan = diffSchema(emptySnapshot(), desired);

    expect(plan).toMatchSnapshot();
  });

  test("generates add_column for a new column on an existing table", () => {
    const snapshot: MysqlDbSnapshot = {
      tables: new Map([
        [
          "users",
          {
            name: "users",
            columns: [
              {
                name: "id",
                dataType: "char",
                columnType: "char(36)",
                nullable: false,
                defaultValue: null,
                maxLength: 36,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 1,
              },
            ],
            indexes: [],
            foreignKeys: [],
            checkConstraints: [],
            uniqueConstraints: [],
            triggers: [],
          },
        ],
      ]),
    };

    const desired: MysqlDesiredSchema = {
      tables: [
        {
          name: "users",
          columns: [
            {
              name: "id",
              mysqlType: "char(36)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
            {
              name: "email",
              mysqlType: "varchar(320)",
              nullable: true,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
          ],
          primaryKeys: ["id"],
          foreignKeys: [],
          uniqueConstraints: [],
          triggers: [],
          checkConstraints: [],
          indexes: [],
        },
      ],
    };

    const plan = diffSchema(snapshot, desired);

    expect(plan).toMatchSnapshot();
  });

  test("generates modify_column when column type changes", () => {
    const snapshot: MysqlDbSnapshot = {
      tables: new Map([
        [
          "users",
          {
            name: "users",
            columns: [
              {
                name: "id",
                dataType: "char",
                columnType: "char(36)",
                nullable: false,
                defaultValue: null,
                maxLength: 36,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 1,
              },
              {
                name: "score",
                dataType: "int",
                columnType: "int",
                nullable: false,
                defaultValue: null,
                maxLength: null,
                numericPrecision: 10,
                numericScale: 0,
                extra: "",
                ordinalPosition: 2,
              },
            ],
            indexes: [],
            foreignKeys: [],
            checkConstraints: [],
            uniqueConstraints: [],
            triggers: [],
          },
        ],
      ]),
    };

    const desired: MysqlDesiredSchema = {
      tables: [
        {
          name: "users",
          columns: [
            {
              name: "id",
              mysqlType: "char(36)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
            {
              name: "score",
              mysqlType: "bigint",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
          ],
          primaryKeys: ["id"],
          foreignKeys: [],
          uniqueConstraints: [],
          triggers: [],
          checkConstraints: [],
          indexes: [],
        },
      ],
    };

    const plan = diffSchema(snapshot, desired);

    expect(plan).toMatchSnapshot();
  });

  test("generates add_index and drop_index for index changes", () => {
    const snapshot: MysqlDbSnapshot = {
      tables: new Map([
        [
          "users",
          {
            name: "users",
            columns: [
              {
                name: "id",
                dataType: "char",
                columnType: "char(36)",
                nullable: false,
                defaultValue: null,
                maxLength: 36,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 1,
              },
              {
                name: "name",
                dataType: "varchar",
                columnType: "varchar(255)",
                nullable: false,
                defaultValue: null,
                maxLength: 255,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 2,
              },
            ],
            indexes: [
              {
                name: "idx_old",
                unique: false,
                indexType: "BTREE",
                columns: [
                  { name: "name", seq: 1, subPart: null, direction: "asc" as const },
                ],
              },
            ],
            foreignKeys: [],
            checkConstraints: [],
            uniqueConstraints: [],
            triggers: [],
          },
        ],
      ]),
    };

    const desired: MysqlDesiredSchema = {
      tables: [
        {
          name: "users",
          columns: [
            {
              name: "id",
              mysqlType: "char(36)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
            {
              name: "name",
              mysqlType: "varchar(255)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
          ],
          primaryKeys: ["id"],
          foreignKeys: [],
          uniqueConstraints: [],
          triggers: [],
          checkConstraints: [],
          indexes: [
            {
              name: "idx_new",
              unique: false,
              columns: [{ name: "name", direction: "asc", prefixLength: null }],
            },
          ],
        },
      ],
    };

    const plan = diffSchema(snapshot, desired);

    expect(plan).toMatchSnapshot();
  });

  test("generates add_fk and drop_fk for FK changes", () => {
    const snapshot: MysqlDbSnapshot = {
      tables: new Map([
        [
          "posts",
          {
            name: "posts",
            columns: [
              {
                name: "id",
                dataType: "char",
                columnType: "char(36)",
                nullable: false,
                defaultValue: null,
                maxLength: 36,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 1,
              },
              {
                name: "author_id",
                dataType: "char",
                columnType: "char(36)",
                nullable: false,
                defaultValue: null,
                maxLength: 36,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 2,
              },
            ],
            indexes: [],
            foreignKeys: [
              {
                constraintName: "fk_old",
                columns: ["author_id"],
                referencedTable: "users",
                referencedColumns: ["id"],
                deleteRule: "CASCADE",
                updateRule: "CASCADE",
              },
            ],
            checkConstraints: [],
            uniqueConstraints: [],
            triggers: [],
          },
        ],
      ]),
    };

    const desired: MysqlDesiredSchema = {
      tables: [
        {
          name: "posts",
          columns: [
            {
              name: "id",
              mysqlType: "char(36)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
            {
              name: "author_id",
              mysqlType: "char(36)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
          ],
          primaryKeys: ["id"],
          foreignKeys: [
            {
              constraintName: "fk_new",
              columns: ["author_id"],
              foreignTable: "users",
              foreignColumns: ["id"],
              onDelete: "CASCADE",
              onUpdate: "CASCADE",
            },
          ],
          uniqueConstraints: [],
          triggers: [],
          checkConstraints: [],
          indexes: [],
        },
      ],
    };

    const plan = diffSchema(snapshot, desired);

    expect(plan).toMatchSnapshot();
  });

  test("topologically sorts create_table operations", () => {
    const desired: MysqlDesiredSchema = {
      tables: [
        {
          name: "posts",
          columns: [
            {
              name: "id",
              mysqlType: "char(36)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
            {
              name: "author_id",
              mysqlType: "char(36)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
          ],
          primaryKeys: ["id"],
          foreignKeys: [
            {
              constraintName: "fk_author",
              columns: ["author_id"],
              foreignTable: "users",
              foreignColumns: ["id"],
              onDelete: "CASCADE",
              onUpdate: "CASCADE",
            },
          ],
          uniqueConstraints: [],
          triggers: [],
          checkConstraints: [],
          indexes: [],
        },
        {
          name: "users",
          columns: [
            {
              name: "id",
              mysqlType: "char(36)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
          ],
          primaryKeys: ["id"],
          foreignKeys: [],
          uniqueConstraints: [],
          triggers: [],
          checkConstraints: [],
          indexes: [],
        },
      ],
    };

    const plan = diffSchema(emptySnapshot(), desired);

    // users should come before posts due to FK dependency
    const createOps = plan.operations.filter((op) => op.type === "create_table");
    expect(createOps[0].tableName).toBe("users");
    expect(createOps[1].tableName).toBe("posts");
  });

  test("generates add_unique for new unique constraints", () => {
    const snapshot: MysqlDbSnapshot = {
      tables: new Map([
        [
          "users",
          {
            name: "users",
            columns: [
              {
                name: "id",
                dataType: "char",
                columnType: "char(36)",
                nullable: false,
                defaultValue: null,
                maxLength: 36,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 1,
              },
              {
                name: "email",
                dataType: "varchar",
                columnType: "varchar(320)",
                nullable: false,
                defaultValue: null,
                maxLength: 320,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 2,
              },
            ],
            indexes: [],
            foreignKeys: [],
            checkConstraints: [],
            uniqueConstraints: [],
            triggers: [],
          },
        ],
      ]),
    };

    const desired: MysqlDesiredSchema = {
      tables: [
        {
          name: "users",
          columns: [
            {
              name: "id",
              mysqlType: "char(36)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
            {
              name: "email",
              mysqlType: "varchar(320)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
          ],
          primaryKeys: ["id"],
          foreignKeys: [],
          uniqueConstraints: [
            { name: "uq_email", columns: [{ name: "email", prefixLength: null }] },
          ],
          checkConstraints: [],
          indexes: [],
          triggers: [],
        },
      ],
    };

    const plan = diffSchema(snapshot, desired);

    expect(plan).toMatchSnapshot();
  });

  test("generates modify_column for enum value changes", () => {
    const snapshot: MysqlDbSnapshot = {
      tables: new Map([
        [
          "users",
          {
            name: "users",
            columns: [
              {
                name: "id",
                dataType: "char",
                columnType: "char(36)",
                nullable: false,
                defaultValue: null,
                maxLength: 36,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 1,
              },
              {
                name: "status",
                dataType: "enum",
                columnType: "enum('active','inactive')",
                nullable: false,
                defaultValue: null,
                maxLength: 8,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 2,
              },
            ],
            indexes: [],
            foreignKeys: [],
            checkConstraints: [],
            uniqueConstraints: [],
            triggers: [],
          },
        ],
      ]),
    };

    const desired: MysqlDesiredSchema = {
      tables: [
        {
          name: "users",
          columns: [
            {
              name: "id",
              mysqlType: "char(36)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
            {
              name: "status",
              mysqlType: "enum('active','inactive','suspended')",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: ["active", "inactive", "suspended"],
            },
          ],
          primaryKeys: ["id"],
          foreignKeys: [],
          uniqueConstraints: [],
          triggers: [],
          checkConstraints: [],
          indexes: [],
        },
      ],
    };

    const plan = diffSchema(snapshot, desired);

    expect(plan).toMatchSnapshot();
  });

  test("generates drop_column for removed columns", () => {
    const snapshot: MysqlDbSnapshot = {
      tables: new Map([
        [
          "users",
          {
            name: "users",
            columns: [
              {
                name: "id",
                dataType: "char",
                columnType: "char(36)",
                nullable: false,
                defaultValue: null,
                maxLength: 36,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 1,
              },
              {
                name: "name",
                dataType: "varchar",
                columnType: "varchar(255)",
                nullable: false,
                defaultValue: null,
                maxLength: 255,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 2,
              },
              {
                name: "legacy_field",
                dataType: "varchar",
                columnType: "varchar(100)",
                nullable: true,
                defaultValue: null,
                maxLength: 100,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 3,
              },
            ],
            indexes: [],
            foreignKeys: [],
            checkConstraints: [],
            uniqueConstraints: [],
            triggers: [],
          },
        ],
      ]),
    };

    const desired: MysqlDesiredSchema = {
      tables: [
        {
          name: "users",
          columns: [
            {
              name: "id",
              mysqlType: "char(36)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
            {
              name: "name",
              mysqlType: "varchar(255)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
          ],
          primaryKeys: ["id"],
          foreignKeys: [],
          uniqueConstraints: [],
          triggers: [],
          checkConstraints: [],
          indexes: [],
        },
      ],
    };

    const plan = diffSchema(snapshot, desired);

    expect(plan).toMatchSnapshot();
  });

  test("does not drop PK columns", () => {
    const snapshot: MysqlDbSnapshot = {
      tables: new Map([
        [
          "users",
          {
            name: "users",
            columns: [
              {
                name: "id",
                dataType: "char",
                columnType: "char(36)",
                nullable: false,
                defaultValue: null,
                maxLength: 36,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 1,
              },
              {
                name: "extra_col",
                dataType: "varchar",
                columnType: "varchar(50)",
                nullable: true,
                defaultValue: null,
                maxLength: 50,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 2,
              },
            ],
            indexes: [],
            foreignKeys: [],
            checkConstraints: [],
            uniqueConstraints: [],
            triggers: [],
          },
        ],
      ]),
    };

    const desired: MysqlDesiredSchema = {
      tables: [
        {
          name: "users",
          columns: [
            {
              name: "id",
              mysqlType: "char(36)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
          ],
          primaryKeys: ["id"],
          foreignKeys: [],
          uniqueConstraints: [],
          triggers: [],
          checkConstraints: [],
          indexes: [],
        },
      ],
    };

    const plan = diffSchema(snapshot, desired);

    // Should drop extra_col but NOT id
    const dropOps = plan.operations.filter((op) => op.type === "drop_column");
    expect(dropOps).toHaveLength(1);
    expect((dropOps[0] as any).columnName).toBe("extra_col");
  });

  test("does not drop __discriminator column when it is in desired schema", () => {
    const snapshot: MysqlDbSnapshot = {
      tables: new Map([
        [
          "animals",
          {
            name: "animals",
            columns: [
              {
                name: "id",
                dataType: "char",
                columnType: "char(36)",
                nullable: false,
                defaultValue: null,
                maxLength: 36,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 1,
              },
              {
                name: "__discriminator",
                dataType: "varchar",
                columnType: "varchar(255)",
                nullable: false,
                defaultValue: null,
                maxLength: 255,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 2,
              },
            ],
            indexes: [],
            foreignKeys: [],
            checkConstraints: [],
            uniqueConstraints: [],
            triggers: [],
          },
        ],
      ]),
    };

    const desired: MysqlDesiredSchema = {
      tables: [
        {
          name: "animals",
          columns: [
            {
              name: "id",
              mysqlType: "char(36)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
            {
              name: "__discriminator",
              mysqlType: "varchar(255)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
          ],
          primaryKeys: ["id"],
          foreignKeys: [],
          uniqueConstraints: [],
          triggers: [],
          checkConstraints: [],
          indexes: [],
        },
      ],
    };

    const plan = diffSchema(snapshot, desired);

    expect(plan.operations.filter((op) => op.type === "drop_column")).toHaveLength(0);
  });

  test("generates drop_constraint for removed check constraints", () => {
    const snapshot: MysqlDbSnapshot = {
      tables: new Map([
        [
          "users",
          {
            name: "users",
            columns: [
              {
                name: "id",
                dataType: "char",
                columnType: "char(36)",
                nullable: false,
                defaultValue: null,
                maxLength: 36,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 1,
              },
              {
                name: "age",
                dataType: "int",
                columnType: "int",
                nullable: false,
                defaultValue: null,
                maxLength: null,
                numericPrecision: 10,
                numericScale: 0,
                extra: "",
                ordinalPosition: 2,
              },
            ],
            indexes: [],
            foreignKeys: [],
            checkConstraints: [
              { constraintName: "chk_age_positive", checkClause: "`age` > 0" },
              { constraintName: "chk_age_max", checkClause: "`age` < 200" },
            ],
            uniqueConstraints: [],
            triggers: [],
          },
        ],
      ]),
    };

    const desired: MysqlDesiredSchema = {
      tables: [
        {
          name: "users",
          columns: [
            {
              name: "id",
              mysqlType: "char(36)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
            {
              name: "age",
              mysqlType: "int",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
          ],
          primaryKeys: ["id"],
          foreignKeys: [],
          uniqueConstraints: [],
          triggers: [],
          checkConstraints: [{ name: "chk_age_positive", expression: "`age` > 0" }],
          indexes: [],
        },
      ],
    };

    const plan = diffSchema(snapshot, desired);

    expect(plan).toMatchSnapshot();
  });

  test("detects unique constraint column composition changes", () => {
    const snapshot: MysqlDbSnapshot = {
      tables: new Map([
        [
          "users",
          {
            name: "users",
            columns: [
              {
                name: "id",
                dataType: "char",
                columnType: "char(36)",
                nullable: false,
                defaultValue: null,
                maxLength: 36,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 1,
              },
              {
                name: "email",
                dataType: "varchar",
                columnType: "varchar(320)",
                nullable: false,
                defaultValue: null,
                maxLength: 320,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 2,
              },
              {
                name: "tenant_id",
                dataType: "char",
                columnType: "char(36)",
                nullable: false,
                defaultValue: null,
                maxLength: 36,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 3,
              },
            ],
            indexes: [],
            foreignKeys: [],
            checkConstraints: [],
            uniqueConstraints: [
              {
                constraintName: "uq_email",
                columns: [{ name: "email", ordinalPosition: 1, subPart: null }],
              },
            ],
            triggers: [],
          },
        ],
      ]),
    };

    const desired: MysqlDesiredSchema = {
      tables: [
        {
          name: "users",
          columns: [
            {
              name: "id",
              mysqlType: "char(36)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
            {
              name: "email",
              mysqlType: "varchar(320)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
            {
              name: "tenant_id",
              mysqlType: "char(36)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
          ],
          primaryKeys: ["id"],
          foreignKeys: [],
          uniqueConstraints: [
            {
              name: "uq_email",
              columns: [
                { name: "email", prefixLength: null },
                { name: "tenant_id", prefixLength: null },
              ],
            },
          ],
          checkConstraints: [],
          indexes: [],
          triggers: [],
        },
      ],
    };

    const plan = diffSchema(snapshot, desired);

    expect(plan).toMatchSnapshot();
  });

  test("generates drop_unique for removed unique constraints", () => {
    const snapshot: MysqlDbSnapshot = {
      tables: new Map([
        [
          "users",
          {
            name: "users",
            columns: [
              {
                name: "id",
                dataType: "char",
                columnType: "char(36)",
                nullable: false,
                defaultValue: null,
                maxLength: 36,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 1,
              },
              {
                name: "email",
                dataType: "varchar",
                columnType: "varchar(320)",
                nullable: false,
                defaultValue: null,
                maxLength: 320,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 2,
              },
            ],
            indexes: [],
            foreignKeys: [],
            checkConstraints: [],
            uniqueConstraints: [
              {
                constraintName: "uq_email",
                columns: [{ name: "email", ordinalPosition: 1, subPart: null }],
              },
              {
                constraintName: "uq_old",
                columns: [{ name: "email", ordinalPosition: 1, subPart: null }],
              },
            ],
            triggers: [],
          },
        ],
      ]),
    };

    const desired: MysqlDesiredSchema = {
      tables: [
        {
          name: "users",
          columns: [
            {
              name: "id",
              mysqlType: "char(36)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
            {
              name: "email",
              mysqlType: "varchar(320)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
          ],
          primaryKeys: ["id"],
          foreignKeys: [],
          uniqueConstraints: [
            { name: "uq_email", columns: [{ name: "email", prefixLength: null }] },
          ],
          checkConstraints: [],
          indexes: [],
          triggers: [],
        },
      ],
    };

    const plan = diffSchema(snapshot, desired);

    expect(plan).toMatchSnapshot();
    // uq_old should be dropped since it's not in the desired schema
    // In MySQL, unique constraints are dropped via drop_constraint (DROP INDEX)
    const dropConstraintOps = plan.operations.filter(
      (op) => op.type === "drop_constraint" && (op as any).constraintName === "uq_old",
    );
    expect(dropConstraintOps).toHaveLength(1);
  });

  test("returns empty plan when schema matches", () => {
    const snapshot: MysqlDbSnapshot = {
      tables: new Map([
        [
          "users",
          {
            name: "users",
            columns: [
              {
                name: "id",
                dataType: "char",
                columnType: "char(36)",
                nullable: false,
                defaultValue: null,
                maxLength: 36,
                numericPrecision: null,
                numericScale: null,
                extra: "",
                ordinalPosition: 1,
              },
            ],
            indexes: [],
            foreignKeys: [],
            checkConstraints: [],
            uniqueConstraints: [],
            triggers: [],
          },
        ],
      ]),
    };

    const desired: MysqlDesiredSchema = {
      tables: [
        {
          name: "users",
          columns: [
            {
              name: "id",
              mysqlType: "char(36)",
              nullable: false,
              defaultExpr: null,
              isAutoIncrement: false,
              enumValues: null,
            },
          ],
          primaryKeys: ["id"],
          foreignKeys: [],
          uniqueConstraints: [],
          triggers: [],
          checkConstraints: [],
          indexes: [],
        },
      ],
    };

    const plan = diffSchema(snapshot, desired);

    expect(plan.operations).toHaveLength(0);
  });
});
