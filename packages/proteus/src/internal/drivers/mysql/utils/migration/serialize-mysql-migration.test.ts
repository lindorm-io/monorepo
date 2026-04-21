import type { MysqlDbSnapshot } from "../../types/db-snapshot.js";
import type { MysqlSyncPlan } from "../../types/sync-plan.js";
import { serializeMysqlMigration } from "./serialize-mysql-migration.js";
import { describe, expect, it, vi } from "vitest";

// Stable UUID for deterministic snapshots
vi.mock("crypto", async () => ({
  ...(await vi.importActual<typeof import("crypto")>("crypto")),
  randomUUID: vi.fn(() => "00000000-0000-0000-0000-000000000001"),
}));

const fixedDate = new Date("2026-02-20T09:00:00.000Z");
const emptySnapshot: MysqlDbSnapshot = { tables: new Map() };

const emptyPlan: MysqlSyncPlan = { operations: [] };

const singleOpPlan: MysqlSyncPlan = {
  operations: [
    {
      type: "add_column",
      tableName: "users",
      sql: "ALTER TABLE `users` ADD COLUMN `email` VARCHAR(255) NOT NULL DEFAULT '';",
    },
  ],
};

const multiOpPlan: MysqlSyncPlan = {
  operations: [
    {
      type: "create_table",
      tableName: "orders",
      sql: "CREATE TABLE `orders` (`id` CHAR(36) NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
      foreignTableDeps: [],
    },
    {
      type: "add_column",
      tableName: "orders",
      sql: "ALTER TABLE `orders` ADD COLUMN `total` DECIMAL(10,2) NOT NULL DEFAULT 0;",
    },
    {
      type: "add_index",
      tableName: "orders",
      indexName: "idx_total",
      sql: "CREATE INDEX `idx_total` ON `orders` (`total` ASC);",
    },
    {
      type: "add_fk",
      tableName: "orders",
      constraintName: "fk_user",
      sql: "ALTER TABLE `orders` ADD CONSTRAINT `fk_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;",
    },
  ],
};

describe("serializeMysqlMigration", () => {
  it("should produce correct filename with custom name", () => {
    const result = serializeMysqlMigration(singleOpPlan, emptySnapshot, {
      name: "add-email",
      timestamp: fixedDate,
    });
    expect(result.filename).toMatchSnapshot();
  });

  it("should produce correct filename with generated name", () => {
    const result = serializeMysqlMigration(singleOpPlan, emptySnapshot, {
      timestamp: fixedDate,
    });
    expect(result.filename).toMatchSnapshot();
  });

  it("should set stable id and ts", () => {
    const result = serializeMysqlMigration(singleOpPlan, emptySnapshot, {
      timestamp: fixedDate,
    });
    expect(result.id).toMatchSnapshot();
    expect(result.ts).toMatchSnapshot();
  });

  it("should produce a non-empty checksum string", () => {
    const result = serializeMysqlMigration(singleOpPlan, emptySnapshot, {
      timestamp: fixedDate,
    });
    expect(typeof result.checksum).toBe("string");
    expect(result.checksum.length).toBeGreaterThan(0);
  });

  it("should produce different checksums for different plans", () => {
    const a = serializeMysqlMigration(singleOpPlan, emptySnapshot, {
      timestamp: fixedDate,
    });
    const b = serializeMysqlMigration(multiOpPlan, emptySnapshot, {
      timestamp: fixedDate,
    });
    expect(a.checksum).not.toBe(b.checksum);
  });

  it("should generate full migration content for a single add_column", () => {
    const result = serializeMysqlMigration(singleOpPlan, emptySnapshot, {
      name: "add-email",
      timestamp: fixedDate,
    });
    expect(result.content).toMatchSnapshot();
  });

  it("should generate full migration content for multiple operations", () => {
    const result = serializeMysqlMigration(multiOpPlan, emptySnapshot, {
      name: "create-orders",
      timestamp: fixedDate,
    });
    expect(result.content).toMatchSnapshot();
  });

  it("should generate content with no custom name (generated class name)", () => {
    const result = serializeMysqlMigration(singleOpPlan, emptySnapshot, {
      timestamp: fixedDate,
    });
    expect(result.content).toMatchSnapshot();
  });

  it("should handle empty plan with no operations", () => {
    const result = serializeMysqlMigration(emptyPlan, emptySnapshot, {
      name: "empty",
      timestamp: fixedDate,
    });
    expect(result.content).toMatchSnapshot();
  });

  it("should include WARN comment for irreversible drop_column in down body", () => {
    const plan: MysqlSyncPlan = {
      operations: [
        {
          type: "drop_column",
          tableName: "users",
          columnName: "legacy",
          sql: "ALTER TABLE `users` DROP COLUMN `legacy`;",
        },
      ],
    };
    const result = serializeMysqlMigration(plan, emptySnapshot, {
      name: "drop-legacy",
      timestamp: fixedDate,
    });
    expect(result.content).toMatchSnapshot();
  });

  it("should include WARN comment for irreversible drop_constraint in down body", () => {
    const plan: MysqlSyncPlan = {
      operations: [
        {
          type: "drop_constraint",
          tableName: "users",
          constraintName: "chk_old",
          sql: "ALTER TABLE `users` DROP CHECK `chk_old`;",
        },
      ],
    };
    const result = serializeMysqlMigration(plan, emptySnapshot, {
      name: "drop-check",
      timestamp: fixedDate,
    });
    expect(result.content).toMatchSnapshot();
  });

  it("should reverse down entries for correct undo ordering", () => {
    const plan: MysqlSyncPlan = {
      operations: [
        {
          type: "create_table",
          tableName: "orders",
          sql: "CREATE TABLE `orders` (`id` CHAR(36) NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB;",
          foreignTableDeps: [],
        },
        {
          type: "add_index",
          tableName: "orders",
          indexName: "idx_a",
          sql: "CREATE INDEX `idx_a` ON `orders` (`a` ASC);",
        },
      ],
    };
    const result = serializeMysqlMigration(plan, emptySnapshot, {
      name: "ordered",
      timestamp: fixedDate,
    });
    // Down body should drop index first, then drop table
    expect(result.content).toMatchSnapshot();
  });

  it("should escape backticks in SQL within template literals", () => {
    const plan: MysqlSyncPlan = {
      operations: [
        {
          type: "add_check",
          tableName: "users",
          constraintName: "chk_name",
          sql: "ALTER TABLE `users` ADD CONSTRAINT `chk_name` CHECK (`name` <> '');",
        },
      ],
    };
    const result = serializeMysqlMigration(plan, emptySnapshot, {
      name: "check-name",
      timestamp: fixedDate,
    });
    expect(result.content).toMatchSnapshot();
  });

  it("should escape dollar signs in SQL", () => {
    const plan: MysqlSyncPlan = {
      operations: [
        {
          type: "add_check",
          tableName: "prices",
          constraintName: "chk_price",
          sql: "ALTER TABLE `prices` ADD CONSTRAINT `chk_price` CHECK (`amount` > $0);",
        },
      ],
    };
    const result = serializeMysqlMigration(plan, emptySnapshot, {
      name: "check-price",
      timestamp: fixedDate,
    });
    expect(result.content).toMatchSnapshot();
  });

  it("should escape backslashes in SQL", () => {
    const plan: MysqlSyncPlan = {
      operations: [
        {
          type: "add_check",
          tableName: "paths",
          constraintName: "chk_path",
          sql: "ALTER TABLE `paths` ADD CONSTRAINT `chk_path` CHECK (`path` LIKE 'C:\\\\%');",
        },
      ],
    };
    const result = serializeMysqlMigration(plan, emptySnapshot, {
      name: "check-path",
      timestamp: fixedDate,
    });
    expect(result.content).toMatchSnapshot();
  });

  it("should sanitize special characters in name for filename", () => {
    const result = serializeMysqlMigration(singleOpPlan, emptySnapshot, {
      name: "My Cool Migration!@#",
      timestamp: fixedDate,
    });
    expect(result.filename).toMatchSnapshot();
  });

  it("should set driver to mysql in generated class", () => {
    const result = serializeMysqlMigration(singleOpPlan, emptySnapshot, {
      name: "test",
      timestamp: fixedDate,
    });
    expect(result.content).toContain('public readonly driver = "mysql";');
  });

  it("should include MigrationInterface import", () => {
    const result = serializeMysqlMigration(singleOpPlan, emptySnapshot, {
      name: "test",
      timestamp: fixedDate,
    });
    expect(result.content).toContain(
      'import type { MigrationInterface, SqlMigrationRunner } from "@lindorm/proteus";',
    );
  });

  it("should generate full migration content for trigger operations", () => {
    const plan: MysqlSyncPlan = {
      operations: [
        {
          type: "create_trigger",
          tableName: "events",
          triggerName: "trg_events_no_update",
          sql: "CREATE TRIGGER `trg_events_no_update` BEFORE UPDATE ON `events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Updates not allowed on append-only table'; END;",
        },
        {
          type: "create_trigger",
          tableName: "events",
          triggerName: "trg_events_no_delete",
          sql: "CREATE TRIGGER `trg_events_no_delete` BEFORE DELETE ON `events` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Deletes not allowed on append-only table'; END;",
        },
      ],
    };
    const result = serializeMysqlMigration(plan, emptySnapshot, {
      name: "add-append-only-triggers",
      timestamp: fixedDate,
    });
    expect(result.content).toMatchSnapshot();
  });

  it("should generate full migration content for drop_trigger operations", () => {
    const plan: MysqlSyncPlan = {
      operations: [
        {
          type: "drop_trigger",
          tableName: "events",
          triggerName: "trg_events_no_update",
          sql: "DROP TRIGGER IF EXISTS `trg_events_no_update`;",
        },
      ],
    };
    const result = serializeMysqlMigration(plan, emptySnapshot, {
      name: "drop-trigger",
      timestamp: fixedDate,
    });
    expect(result.content).toMatchSnapshot();
  });

  it("should use modify_column with snapshot-based down sql", () => {
    const snapshot: MysqlDbSnapshot = {
      tables: new Map([
        [
          "users",
          {
            name: "users",
            columns: [
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
    const plan: MysqlSyncPlan = {
      operations: [
        {
          type: "modify_column",
          tableName: "users",
          columnName: "email",
          sql: "ALTER TABLE `users` MODIFY COLUMN `email` TEXT NOT NULL;",
        },
      ],
    };
    const result = serializeMysqlMigration(plan, snapshot, {
      name: "modify-email",
      timestamp: fixedDate,
    });
    expect(result.content).toMatchSnapshot();
  });
});
