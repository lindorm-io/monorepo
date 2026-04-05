import type { MysqlDbSnapshot, MysqlSnapshotTable } from "../../types/db-snapshot";
import type { MysqlSyncOperation } from "../../types/sync-plan";
import { generateMysqlDownSql } from "./generate-down-sql";

const emptySnapshot: MysqlDbSnapshot = { tables: new Map() };

const makeTable = (overrides?: Partial<MysqlSnapshotTable>): MysqlSnapshotTable => ({
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
      columnType: "varchar(255)",
      nullable: false,
      defaultValue: "''",
      maxLength: 255,
      numericPrecision: null,
      numericScale: null,
      extra: "",
      ordinalPosition: 2,
    },
    {
      name: "age",
      dataType: "int",
      columnType: "int",
      nullable: true,
      defaultValue: null,
      maxLength: null,
      numericPrecision: 10,
      numericScale: 0,
      extra: "",
      ordinalPosition: 3,
    },
    {
      name: "counter",
      dataType: "int",
      columnType: "int",
      nullable: false,
      defaultValue: null,
      maxLength: null,
      numericPrecision: 10,
      numericScale: 0,
      extra: "auto_increment",
      ordinalPosition: 4,
    },
    {
      name: "computed",
      dataType: "int",
      columnType: "int",
      nullable: true,
      defaultValue: null,
      maxLength: null,
      numericPrecision: 10,
      numericScale: 0,
      extra: "stored generated",
      ordinalPosition: 5,
    },
  ],
  indexes: [
    {
      name: "idx_email",
      columns: [{ name: "email", seq: 1, subPart: null, direction: "asc" }],
      unique: false,
      indexType: "BTREE",
    },
    {
      name: "idx_compound",
      columns: [
        { name: "email", seq: 1, subPart: null, direction: "asc" },
        { name: "age", seq: 2, subPart: null, direction: "desc" },
      ],
      unique: true,
      indexType: "BTREE",
    },
  ],
  foreignKeys: [
    {
      constraintName: "fk_org",
      columns: ["org_id"],
      referencedTable: "orgs",
      referencedColumns: ["id"],
      deleteRule: "CASCADE",
      updateRule: "NO ACTION",
    },
    {
      constraintName: "fk_team",
      columns: ["team_id"],
      referencedTable: "teams",
      referencedColumns: ["id"],
      deleteRule: "NO ACTION",
      updateRule: "CASCADE",
    },
  ],
  checkConstraints: [{ constraintName: "chk_age", checkClause: "(`age` >= 0)" }],
  uniqueConstraints: [
    {
      constraintName: "uq_email",
      columns: [{ name: "email", ordinalPosition: 1, subPart: null }],
    },
  ],
  triggers: [],
  ...overrides,
});

const snapshotWithTable = (overrides?: Partial<MysqlSnapshotTable>): MysqlDbSnapshot => {
  const table = makeTable(overrides);
  return { tables: new Map([["users", table]]) };
};

// --- create_table ---

describe("generateMysqlDownSql — create_table", () => {
  it("should produce DROP TABLE IF EXISTS", () => {
    const op: MysqlSyncOperation = {
      type: "create_table",
      tableName: "users",
      sql: "CREATE TABLE `users` (`id` CHAR(36) NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
      foreignTableDeps: [],
    };
    expect(generateMysqlDownSql(op, emptySnapshot)).toMatchSnapshot();
  });
});

// --- add_column ---

describe("generateMysqlDownSql — add_column", () => {
  it("should produce DROP COLUMN from ADD COLUMN sql", () => {
    const op: MysqlSyncOperation = {
      type: "add_column",
      tableName: "users",
      sql: "ALTER TABLE `users` ADD COLUMN `email` VARCHAR(255) NOT NULL DEFAULT '';",
    };
    expect(generateMysqlDownSql(op, emptySnapshot)).toMatchSnapshot();
  });

  it("should return null when column name cannot be extracted", () => {
    const op: MysqlSyncOperation = {
      type: "add_column",
      tableName: "users",
      sql: "ALTER TABLE `users` SOMETHING WEIRD;",
    };
    expect(generateMysqlDownSql(op, emptySnapshot)).toBeNull();
  });
});

// --- modify_column ---

describe("generateMysqlDownSql — modify_column", () => {
  it("should reconstruct previous column definition from snapshot", () => {
    const op: MysqlSyncOperation = {
      type: "modify_column",
      tableName: "users",
      columnName: "email",
      sql: "ALTER TABLE `users` MODIFY COLUMN `email` TEXT NOT NULL;",
    };
    expect(generateMysqlDownSql(op, snapshotWithTable())).toMatchSnapshot();
  });

  it("should reconstruct nullable column with no default", () => {
    const op: MysqlSyncOperation = {
      type: "modify_column",
      tableName: "users",
      columnName: "age",
      sql: "ALTER TABLE `users` MODIFY COLUMN `age` BIGINT;",
    };
    expect(generateMysqlDownSql(op, snapshotWithTable())).toMatchSnapshot();
  });

  it("should reconstruct auto_increment column", () => {
    const op: MysqlSyncOperation = {
      type: "modify_column",
      tableName: "users",
      columnName: "counter",
      sql: "ALTER TABLE `users` MODIFY COLUMN `counter` BIGINT NOT NULL AUTO_INCREMENT;",
    };
    expect(generateMysqlDownSql(op, snapshotWithTable())).toMatchSnapshot();
  });

  it("should handle stored generated column (minimal reconstruction)", () => {
    const op: MysqlSyncOperation = {
      type: "modify_column",
      tableName: "users",
      columnName: "computed",
      sql: "ALTER TABLE `users` MODIFY COLUMN `computed` BIGINT AS (a + b) STORED;",
    };
    expect(generateMysqlDownSql(op, snapshotWithTable())).toMatchSnapshot();
  });

  it("should return null when table is not in snapshot", () => {
    const op: MysqlSyncOperation = {
      type: "modify_column",
      tableName: "missing",
      columnName: "email",
      sql: "ALTER TABLE `missing` MODIFY COLUMN `email` TEXT;",
    };
    expect(generateMysqlDownSql(op, emptySnapshot)).toBeNull();
  });

  it("should return null when column is not in snapshot table", () => {
    const op: MysqlSyncOperation = {
      type: "modify_column",
      tableName: "users",
      columnName: "nonexistent",
      sql: "ALTER TABLE `users` MODIFY COLUMN `nonexistent` TEXT;",
    };
    expect(generateMysqlDownSql(op, snapshotWithTable())).toBeNull();
  });

  it("should match column name case-insensitively", () => {
    const op: MysqlSyncOperation = {
      type: "modify_column",
      tableName: "users",
      columnName: "EMAIL",
      sql: "ALTER TABLE `users` MODIFY COLUMN `EMAIL` TEXT NOT NULL;",
    };
    expect(generateMysqlDownSql(op, snapshotWithTable())).toMatchSnapshot();
  });
});

// --- drop_column ---

describe("generateMysqlDownSql — drop_column", () => {
  it("should return null (irreversible)", () => {
    const op: MysqlSyncOperation = {
      type: "drop_column",
      tableName: "users",
      columnName: "age",
      sql: "ALTER TABLE `users` DROP COLUMN `age`;",
    };
    expect(generateMysqlDownSql(op, snapshotWithTable())).toBeNull();
  });
});

// --- add_index ---

describe("generateMysqlDownSql — add_index", () => {
  it("should produce DROP INDEX", () => {
    const op: MysqlSyncOperation = {
      type: "add_index",
      tableName: "users",
      indexName: "idx_email",
      sql: "CREATE INDEX `idx_email` ON `users` (`email` ASC);",
    };
    expect(generateMysqlDownSql(op, emptySnapshot)).toMatchSnapshot();
  });
});

// --- drop_index ---

describe("generateMysqlDownSql — drop_index", () => {
  it("should reconstruct simple index from snapshot", () => {
    const op: MysqlSyncOperation = {
      type: "drop_index",
      tableName: "users",
      indexName: "idx_email",
      sql: "DROP INDEX `idx_email` ON `users`;",
    };
    expect(generateMysqlDownSql(op, snapshotWithTable())).toMatchSnapshot();
  });

  it("should reconstruct compound unique index from snapshot", () => {
    const op: MysqlSyncOperation = {
      type: "drop_index",
      tableName: "users",
      indexName: "idx_compound",
      sql: "DROP INDEX `idx_compound` ON `users`;",
    };
    expect(generateMysqlDownSql(op, snapshotWithTable())).toMatchSnapshot();
  });

  it("should return null when table not in snapshot", () => {
    const op: MysqlSyncOperation = {
      type: "drop_index",
      tableName: "missing",
      indexName: "idx_email",
      sql: "DROP INDEX `idx_email` ON `missing`;",
    };
    expect(generateMysqlDownSql(op, emptySnapshot)).toBeNull();
  });

  it("should return null when index not in snapshot", () => {
    const op: MysqlSyncOperation = {
      type: "drop_index",
      tableName: "users",
      indexName: "idx_gone",
      sql: "DROP INDEX `idx_gone` ON `users`;",
    };
    expect(generateMysqlDownSql(op, snapshotWithTable())).toBeNull();
  });
});

// --- add_fk ---

describe("generateMysqlDownSql — add_fk", () => {
  it("should produce DROP FOREIGN KEY", () => {
    const op: MysqlSyncOperation = {
      type: "add_fk",
      tableName: "users",
      constraintName: "fk_org",
      sql: "ALTER TABLE `users` ADD CONSTRAINT `fk_org` FOREIGN KEY (`org_id`) REFERENCES `orgs` (`id`) ON DELETE CASCADE;",
    };
    expect(generateMysqlDownSql(op, emptySnapshot)).toMatchSnapshot();
  });
});

// --- drop_fk ---

describe("generateMysqlDownSql — drop_fk", () => {
  it("should reconstruct FK with CASCADE delete rule from snapshot", () => {
    const op: MysqlSyncOperation = {
      type: "drop_fk",
      tableName: "users",
      constraintName: "fk_org",
      sql: "ALTER TABLE `users` DROP FOREIGN KEY `fk_org`;",
    };
    expect(generateMysqlDownSql(op, snapshotWithTable())).toMatchSnapshot();
  });

  it("should reconstruct FK with CASCADE update rule from snapshot", () => {
    const op: MysqlSyncOperation = {
      type: "drop_fk",
      tableName: "users",
      constraintName: "fk_team",
      sql: "ALTER TABLE `users` DROP FOREIGN KEY `fk_team`;",
    };
    expect(generateMysqlDownSql(op, snapshotWithTable())).toMatchSnapshot();
  });

  it("should return null when table not in snapshot", () => {
    const op: MysqlSyncOperation = {
      type: "drop_fk",
      tableName: "missing",
      constraintName: "fk_org",
      sql: "ALTER TABLE `missing` DROP FOREIGN KEY `fk_org`;",
    };
    expect(generateMysqlDownSql(op, emptySnapshot)).toBeNull();
  });

  it("should return null when FK not in snapshot", () => {
    const op: MysqlSyncOperation = {
      type: "drop_fk",
      tableName: "users",
      constraintName: "fk_gone",
      sql: "ALTER TABLE `users` DROP FOREIGN KEY `fk_gone`;",
    };
    expect(generateMysqlDownSql(op, snapshotWithTable())).toBeNull();
  });
});

// --- add_check ---

describe("generateMysqlDownSql — add_check", () => {
  it("should produce DROP CHECK", () => {
    const op: MysqlSyncOperation = {
      type: "add_check",
      tableName: "users",
      constraintName: "chk_age",
      sql: "ALTER TABLE `users` ADD CONSTRAINT `chk_age` CHECK (`age` >= 0);",
    };
    expect(generateMysqlDownSql(op, emptySnapshot)).toMatchSnapshot();
  });
});

// --- add_unique ---

describe("generateMysqlDownSql — add_unique", () => {
  it("should produce DROP INDEX (MySQL unique constraints are indexes)", () => {
    const op: MysqlSyncOperation = {
      type: "add_unique",
      tableName: "users",
      constraintName: "uq_email",
      sql: "ALTER TABLE `users` ADD CONSTRAINT `uq_email` UNIQUE (`email`);",
    };
    expect(generateMysqlDownSql(op, emptySnapshot)).toMatchSnapshot();
  });
});

// --- drop_constraint ---

describe("generateMysqlDownSql — drop_constraint", () => {
  it("should return null (irreversible)", () => {
    const op: MysqlSyncOperation = {
      type: "drop_constraint",
      tableName: "users",
      constraintName: "chk_age",
      sql: "ALTER TABLE `users` DROP CHECK `chk_age`;",
    };
    expect(generateMysqlDownSql(op, snapshotWithTable())).toBeNull();
  });
});

// --- create_trigger ---

describe("generateMysqlDownSql — create_trigger", () => {
  it("should produce DROP TRIGGER IF EXISTS for a CREATE TRIGGER sql", () => {
    const op: MysqlSyncOperation = {
      type: "create_trigger",
      tableName: "events",
      triggerName: "trg_events_no_update",
      sql: "CREATE TRIGGER `trg_events_no_update` BEFORE UPDATE ON `events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Updates not allowed on append-only table'; END;",
    };
    expect(generateMysqlDownSql(op, emptySnapshot)).toMatchSnapshot();
  });

  it("should return null for a DROP TRIGGER IF EXISTS setup step", () => {
    const op: MysqlSyncOperation = {
      type: "create_trigger",
      tableName: "events",
      triggerName: "trg_events_no_update",
      sql: "DROP TRIGGER IF EXISTS `trg_events_no_update`;",
    };
    expect(generateMysqlDownSql(op, emptySnapshot)).toBeNull();
  });
});

// --- drop_trigger ---

describe("generateMysqlDownSql — drop_trigger", () => {
  it("should return null (irreversible)", () => {
    const op: MysqlSyncOperation = {
      type: "drop_trigger",
      tableName: "events",
      triggerName: "trg_events_no_update",
      sql: "DROP TRIGGER IF EXISTS `trg_events_no_update`;",
    };
    expect(generateMysqlDownSql(op, emptySnapshot)).toBeNull();
  });
});

// --- unknown type (default branch) ---

describe("generateMysqlDownSql — unknown type", () => {
  it("should return null for unrecognised operation type", () => {
    const op = {
      type: "some_future_op",
      tableName: "users",
      sql: "SOMETHING;",
    } as unknown as MysqlSyncOperation;
    expect(generateMysqlDownSql(op, emptySnapshot)).toBeNull();
  });
});
