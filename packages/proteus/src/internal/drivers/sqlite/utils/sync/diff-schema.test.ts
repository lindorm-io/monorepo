import { describe, expect, test } from "vitest";
import type {
  SqliteDbSnapshot,
  SqliteSnapshotIndexColumn,
  SqliteSnapshotTable,
} from "../../types/db-snapshot.js";
import type {
  SqliteDesiredIndex,
  SqliteDesiredSchema,
  SqliteDesiredTable,
} from "../../types/desired-schema.js";
import { diffSchema } from "./diff-schema.js";

/**
 * `diffSchema` reads a snapshot; it must not rewrite one.
 *
 * The index diff normalises an introspected index's columns into `seqno` order
 * before comparing them — necessary, because sqlite guarantees no row order for
 * `PRAGMA index_info` without an ORDER BY. That sort used to run IN PLACE on
 * `SqliteSnapshotIndex.columns`, so a diff reordered part of the caller's snapshot
 * while it was still reading it.
 *
 * It produced no wrong plan: sorting is idempotent, and sqlite happens to return
 * index_info rows in seqno order anyway, so the mutation was invisible by luck
 * rather than by design. `SqliteMigrationManager.generateMigration` already hands
 * the same live snapshot to `serializeSqliteMigration` after diffing it — the only
 * thing between the mutation and a real consumer is that the serializer ignores
 * its snapshot argument today.
 *
 * So the contract is pinned directly: the snapshot goes in unchanged and comes out
 * unchanged, and the diff still compares by seqno rather than by array order.
 */

/**
 * An index whose stored column array is NOT in seqno order — the case the
 * normalising sort exists for. Built fresh per call so no test can observe
 * another's mutation, and so an assertion never compares an array to itself.
 */
const outOfSeqnoOrder = (): Array<SqliteSnapshotIndexColumn> => [
  { seqno: 1, cid: 2, name: "b" },
  { seqno: 0, cid: 1, name: "a" },
];

const inSeqnoOrder = (): Array<SqliteSnapshotIndexColumn> => [
  { seqno: 0, cid: 1, name: "a" },
  { seqno: 1, cid: 2, name: "b" },
];

const snapshotTable = (
  indexColumns: Array<SqliteSnapshotIndexColumn>,
): SqliteSnapshotTable => ({
  name: "Thing",
  columns: [
    {
      cid: 0,
      name: "id",
      type: "TEXT",
      notNull: true,
      defaultValue: null,
      pk: 1,
      generatedExpr: null,
    },
    {
      cid: 1,
      name: "a",
      type: "TEXT",
      notNull: true,
      defaultValue: null,
      pk: 0,
      generatedExpr: null,
    },
    {
      cid: 2,
      name: "b",
      type: "TEXT",
      notNull: true,
      defaultValue: null,
      pk: 0,
      generatedExpr: null,
    },
  ],
  foreignKeys: [],
  indexes: [
    {
      name: "idx_thing_a_b",
      unique: false,
      origin: "c",
      partial: false,
      columns: indexColumns,
    },
  ],
  triggers: [],
  sql: `CREATE TABLE "Thing" ("id" TEXT NOT NULL, "a" TEXT NOT NULL, "b" TEXT NOT NULL, PRIMARY KEY ("id"));`,
});

const desiredTable = (
  indexColumns: SqliteDesiredIndex["columns"],
): SqliteDesiredTable => ({
  name: "Thing",
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
      name: "a",
      sqliteType: "TEXT",
      nullable: false,
      defaultExpr: null,
      isAutoincrement: false,
      checkExpr: null,
      computed: null,
    },
    {
      name: "b",
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
  indexes: [{ name: "idx_thing_a_b", unique: false, columns: indexColumns, where: null }],
  triggers: [],
});

const desiredSchema = (
  indexColumns: SqliteDesiredIndex["columns"],
): SqliteDesiredSchema => ({ tables: [desiredTable(indexColumns)] });

const snapshotOf = (table: SqliteSnapshotTable): SqliteDbSnapshot => ({
  tables: new Map([[table.name, table]]),
});

const AB: SqliteDesiredIndex["columns"] = [
  { name: "a", direction: "asc" },
  { name: "b", direction: "asc" },
];

const BA: SqliteDesiredIndex["columns"] = [
  { name: "b", direction: "asc" },
  { name: "a", direction: "asc" },
];

describe("diffSchema", () => {
  test("does not reorder the snapshot index columns it normalises", () => {
    const table = snapshotTable(outOfSeqnoOrder());

    diffSchema(snapshotOf(table), desiredSchema(AB));

    // Asserted against a literal, not against the fixture helper's return value —
    // the two must not be the same array, or the mutation would hide itself.
    expect(table.indexes[0].columns).toEqual([
      { seqno: 1, cid: 2, name: "b" },
      { seqno: 0, cid: 1, name: "a" },
    ]);
  });

  test("compares index columns by seqno, not by array order", () => {
    // seqno order is a,b — matching desired — even though the array reads b,a.
    const plan = diffSchema(
      snapshotOf(snapshotTable(outOfSeqnoOrder())),
      desiredSchema(AB),
    );

    expect(plan.operations).toEqual([]);
  });

  test("still detects a genuine index column reorder", () => {
    // seqno order is a,b but desired is b,a — a real change.
    const plan = diffSchema(
      snapshotOf(snapshotTable(outOfSeqnoOrder())),
      desiredSchema(BA),
    );

    expect(plan.operations).toEqual([
      { type: "drop_index", indexName: "idx_thing_a_b" },
      {
        type: "create_index",
        ddl: `CREATE INDEX IF NOT EXISTS "idx_thing_a_b" ON "Thing" ("b" ASC, "a" ASC);`,
      },
    ]);
  });

  test("an unchanged table plans nothing", () => {
    const plan = diffSchema(snapshotOf(snapshotTable(inSeqnoOrder())), desiredSchema(AB));

    expect(plan.operations).toEqual([]);
  });
});
