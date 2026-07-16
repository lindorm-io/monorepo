import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { SqliteQueryClient } from "../../types/sqlite-query-client.js";
import type { SqliteDesiredSchema } from "../../types/desired-schema.js";
import { diffSchema } from "./diff-schema.js";
import { introspectSchema } from "./introspect-schema.js";
import { SyncPlanExecutor } from "./execute-sync-plan.js";

/**
 * Round-trip coverage for the sqlite sync path: a computed column and a
 * deferrable FK must survive CREATE → introspect → diff without phantom drift,
 * and a genuine change to either must be detected. Runs entirely in-memory via
 * better-sqlite3 (no docker) so `PRAGMA table_xinfo` / `sqlite_master` parsing
 * is exercised against a real engine.
 */

const wrap = (db: Database.Database): SqliteQueryClient => ({
  run: (sql, params) => db.prepare(sql).run(...((params ?? []) as Array<unknown>)),
  all: (sql, params) =>
    db.prepare(sql).all(...((params ?? []) as Array<unknown>)) as Array<
      Record<string, unknown>
    >,
  get: (sql, params) =>
    db.prepare(sql).get(...((params ?? []) as Array<unknown>)) as
      | Record<string, unknown>
      | undefined,
  exec: (sql) => db.exec(sql),
  iterate: (sql, params) =>
    db.prepare(sql).iterate(...((params ?? []) as Array<unknown>)) as IterableIterator<
      Record<string, unknown>
    >,
  close: () => db.close(),
  get open() {
    return db.open;
  },
  get name() {
    return db.name;
  },
});

const desiredSchema = (opts: {
  deferrable: boolean;
  initiallyDeferred: boolean;
  computedExpr: string;
}): SqliteDesiredSchema => ({
  tables: [
    {
      name: "Parent",
      columns: [
        {
          name: "id",
          sqliteType: "TEXT",
          nullable: false,
          defaultExpr: null,
          isAutoincrement: false,
          checkExpr: null,
          computed: null,
        },
      ],
      primaryKeys: ["id"],
      foreignKeys: [],
      uniqueConstraints: [],
      checkConstraints: [],
      indexes: [],
      triggers: [],
    },
    {
      name: "Child",
      columns: [
        {
          name: "id",
          sqliteType: "TEXT",
          nullable: false,
          defaultExpr: null,
          isAutoincrement: false,
          checkExpr: null,
          computed: null,
        },
        {
          name: "first",
          sqliteType: "TEXT",
          nullable: false,
          defaultExpr: null,
          isAutoincrement: false,
          checkExpr: null,
          computed: null,
        },
        {
          name: "last",
          sqliteType: "TEXT",
          nullable: false,
          defaultExpr: null,
          isAutoincrement: false,
          checkExpr: null,
          computed: null,
        },
        {
          name: "displayName",
          sqliteType: "TEXT",
          nullable: false,
          defaultExpr: null,
          isAutoincrement: false,
          checkExpr: null,
          computed: opts.computedExpr,
        },
        {
          name: "parentId",
          sqliteType: "TEXT",
          nullable: true,
          defaultExpr: null,
          isAutoincrement: false,
          checkExpr: null,
          computed: null,
        },
      ],
      primaryKeys: ["id"],
      foreignKeys: [
        {
          columns: ["parentId"],
          foreignTable: "Parent",
          foreignColumns: ["id"],
          onDelete: "SET NULL",
          onUpdate: "CASCADE",
          deferrable: opts.deferrable,
          initiallyDeferred: opts.initiallyDeferred,
        },
      ],
      uniqueConstraints: [],
      checkConstraints: [],
      indexes: [],
      triggers: [],
    },
  ],
});

describe("sqlite sync round-trip (computed + deferrable)", () => {
  let db: Database.Database;
  let client: SqliteQueryClient;

  const createFromPlan = (desired: SqliteDesiredSchema): void => {
    // Empty snapshot → all create_table ops; execute in FK-dependency order.
    const plan = diffSchema({ tables: new Map() }, desired);
    const creates = plan.operations.filter((op) => op.type === "create_table");
    // Parent has no deps; execute deps first.
    for (const op of creates) {
      if (op.type === "create_table" && op.foreignTableDeps.length === 0) {
        client.exec(op.ddl);
      }
    }
    for (const op of creates) {
      if (op.type === "create_table" && op.foreignTableDeps.length > 0) {
        client.exec(op.ddl);
      }
    }
  };

  beforeEach(() => {
    db = new Database(":memory:");
    client = wrap(db);
  });

  afterEach(() => {
    db.close();
  });

  test("computed column and deferrable FK survive CREATE → introspect with no phantom drift", () => {
    const desired = desiredSchema({
      deferrable: true,
      initiallyDeferred: true,
      computedExpr: `"first" || ' ' || "last"`,
    });

    createFromPlan(desired);

    const snapshot = introspectSchema(client, ["Parent", "Child"]);

    // The generated column round-trips via table_xinfo + sqlite_master parsing.
    const child = snapshot.tables.get("Child")!;
    const displayName = child.columns.find((c) => c.name === "displayName");
    expect(displayName?.generatedExpr).toBe(`"first" || ' ' || "last"`);

    // The deferrable clause round-trips via sqlite_master parsing.
    const fk = child.foreignKeys.find((f) => f.from === "parentId")!;
    expect(fk.deferrable).toBe(true);
    expect(fk.initiallyDeferred).toBe(true);

    // Re-diffing the introspected state against the same desired → no operations.
    const plan = diffSchema(snapshot, desired);
    expect(plan.operations).toHaveLength(0);
  });

  test("changing the deferrable clause is detected as a rebuild", () => {
    const original = desiredSchema({
      deferrable: true,
      initiallyDeferred: true,
      computedExpr: `"first" || ' ' || "last"`,
    });
    createFromPlan(original);
    const snapshot = introspectSchema(client, ["Parent", "Child"]);

    const changed = desiredSchema({
      deferrable: false,
      initiallyDeferred: false,
      computedExpr: `"first" || ' ' || "last"`,
    });

    const plan = diffSchema(snapshot, changed);
    expect(
      plan.operations.some(
        (op) => op.type === "recreate_table" && op.tableName === "Child",
      ),
    ).toBe(true);
  });

  test("changing the computed expression is detected as a rebuild", () => {
    const original = desiredSchema({
      deferrable: true,
      initiallyDeferred: true,
      computedExpr: `"first" || ' ' || "last"`,
    });
    createFromPlan(original);
    const snapshot = introspectSchema(client, ["Parent", "Child"]);

    const changed = desiredSchema({
      deferrable: true,
      initiallyDeferred: true,
      computedExpr: `"last" || ' ' || "first"`,
    });

    const plan = diffSchema(snapshot, changed);
    expect(
      plan.operations.some(
        (op) => op.type === "recreate_table" && op.tableName === "Child",
      ),
    ).toBe(true);
  });

  test("rebuild excludes the generated column from the copy so INSERT does not target it", () => {
    const original = desiredSchema({
      deferrable: true,
      initiallyDeferred: true,
      computedExpr: `"first" || ' ' || "last"`,
    });
    createFromPlan(original);

    client.exec(`PRAGMA foreign_keys = ON`);
    client.run(`INSERT INTO "Parent" ("id") VALUES (?)`, ["p1"]);
    client.run(
      `INSERT INTO "Child" ("id", "first", "last", "parentId") VALUES (?, ?, ?, ?)`,
      ["c1", "Ada", "Lovelace", "p1"],
    );

    const snapshot = introspectSchema(client, ["Parent", "Child"]);

    // Force a rebuild by flipping the FK deferrability.
    const changed = desiredSchema({
      deferrable: false,
      initiallyDeferred: false,
      computedExpr: `"first" || ' ' || "last"`,
    });

    const plan = diffSchema(snapshot, changed);
    const recreate = plan.operations.find(
      (op) => op.type === "recreate_table" && op.tableName === "Child",
    );
    expect(recreate?.type).toBe("recreate_table");
    if (recreate?.type === "recreate_table") {
      // The generated column must never be an INSERT target during the copy.
      expect(recreate.copyColumns).not.toContain("displayName");
    }

    // Execute for real — INSERT into a generated column would throw otherwise.
    new SyncPlanExecutor().execute(client, plan);

    const row = client.get(`SELECT "displayName" FROM "Child" WHERE "id" = ?`, ["c1"]);
    expect(row?.displayName).toBe("Ada Lovelace");
  });
});
