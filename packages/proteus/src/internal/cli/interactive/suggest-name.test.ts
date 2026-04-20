import type { SyncOperation } from "../../drivers/postgres/types/sync-plan";
import { suggestMigrationName } from "./suggest-name";
import { describe, expect, it } from "vitest";

const makeOp = (type: SyncOperation["type"]): SyncOperation => ({
  type,
  severity: "safe",
  schema: "app",
  table: "users",
  description: `${type} something`,
  sql: `SELECT 1`,
  autocommit: false,
});

describe("suggestMigrationName", () => {
  it("should prefix with 'add' for create_table ops", () => {
    const result = suggestMigrationName(["User"], [makeOp("create_table")]);
    expect(result).toBe("add-user");
  });

  it("should prefix with 'update' for alter ops", () => {
    const result = suggestMigrationName(
      ["User"],
      [makeOp("add_column"), makeOp("alter_column_nullable")],
    );
    expect(result).toBe("update-user");
  });

  it("should prefix with 'drop' for drop ops", () => {
    const result = suggestMigrationName(
      ["Payment"],
      [makeOp("drop_column"), makeOp("drop_index")],
    );
    expect(result).toBe("drop-payment");
  });

  it("should join two entity names with 'and'", () => {
    const result = suggestMigrationName(
      ["User", "Order"],
      [makeOp("create_table"), makeOp("create_table")],
    );
    expect(result).toBe("add-user-and-order");
  });

  it("should use first entity + 'and-more' for 3+ entities", () => {
    const result = suggestMigrationName(
      ["User", "Order", "Payment"],
      [makeOp("create_table"), makeOp("create_table"), makeOp("create_table")],
    );
    expect(result).toBe("add-user-and-more");
  });

  it("should kebab-case PascalCase entity names", () => {
    const result = suggestMigrationName(["UserProfile"], [makeOp("create_table")]);
    expect(result).toBe("add-user-profile");
  });

  it("should handle empty entity names with fallback", () => {
    const result = suggestMigrationName([], [makeOp("add_column")]);
    expect(result).toBe("update-schema");
  });

  it("should filter out empty strings from entity names", () => {
    const result = suggestMigrationName(["", "User"], [makeOp("create_table")]);
    expect(result).toBe("add-user");
  });
});
