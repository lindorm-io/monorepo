import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { SqliteQueryClient } from "../../types/sqlite-query-client.js";
import { introspectSchema } from "./introspect-schema.js";

/**
 * `sqlite_master` is filtered with LIKE, where `_` is the SINGLE-CHARACTER
 * WILDCARD and matching is case-insensitive for ASCII. Both patterns therefore
 * need `ESCAPE`:
 *
 * - `name NOT LIKE 'sqlite_%'` UNDER-matches nothing but OVER-excludes: it hides
 *   every user table named `sqlite` plus at least one more character, which then
 *   introspects as absent and the planner believes it does not exist.
 * - `name LIKE 'proteus_%'` OVER-matches: it claims a user trigger named
 *   `proteusXyz` as proteus-managed, which the diff is then free to drop.
 *
 * Runs in-memory against a real engine with `defaultSafeIntegers(true)`, matching
 * `SqliteDriver.connect`.
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

describe("introspectSchema", () => {
  let db: Database.Database;
  let client: SqliteQueryClient;

  beforeEach(() => {
    db = new Database(":memory:");
    db.defaultSafeIntegers(true);
    client = wrap(db);
  });

  afterEach(() => {
    db.close();
  });

  // sqlite itself reserves the literal `sqlite_` prefix, so every name here is
  // one a user can legitimately create — and every one of them matches the
  // unescaped `sqlite_%` pattern.
  test.each([
    ["SqliteLedger"],
    ["SqliteAppendOnlyLedger"],
    ["sqliteLedger"],
    ["sqliteX"],
  ])(
    "introspects a table named %s, which the unescaped sqlite prefix filter also matched",
    (name) => {
      client.exec(`CREATE TABLE "${name}" ("id" TEXT NOT NULL, PRIMARY KEY ("id"))`);

      const snapshot = introspectSchema(client);

      expect(snapshot.tables.has(name)).toBe(true);
      expect(snapshot.tables.get(name)!.columns.map((c) => c.name)).toEqual(["id"]);
    },
  );

  test("still excludes sqlite's own internal tables", () => {
    // AUTOINCREMENT forces sqlite to create the internal `sqlite_sequence` table.
    client.exec(`CREATE TABLE "Counter" ("id" INTEGER PRIMARY KEY AUTOINCREMENT)`);
    client.run(`INSERT INTO "Counter" DEFAULT VALUES`);

    expect(
      client.all(`SELECT name FROM sqlite_master WHERE name = 'sqlite_sequence'`),
    ).toHaveLength(1);

    const snapshot = introspectSchema(client);

    expect(Array.from(snapshot.tables.keys())).toEqual(["Counter"]);
  });

  test("claims a proteus_-prefixed trigger but not a proteus-prefixed one", () => {
    client.exec(`CREATE TABLE "Ledger" ("id" TEXT NOT NULL, PRIMARY KEY ("id"))`);
    client.exec(
      `CREATE TRIGGER "proteus_ao_Ledger_no_delete" BEFORE DELETE ON "Ledger" BEGIN SELECT RAISE(ABORT, 'append-only'); END`,
    );
    client.exec(
      `CREATE TRIGGER "proteusXyz" BEFORE INSERT ON "Ledger" BEGIN SELECT 1; END`,
    );

    const snapshot = introspectSchema(client, ["Ledger"]);

    expect(snapshot.tables.get("Ledger")!.triggers).toEqual([
      { name: "proteus_ao_Ledger_no_delete" },
    ]);
  });
});
