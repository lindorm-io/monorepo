// Sync lock-timeout behaviour: `synchronize`'s transactional phase must not
// hang indefinitely when another session holds a conflicting lock on a table
// being altered. It bounds the wait via `SET LOCAL lock_timeout` and aborts
// with an actionable error (naming the blocking session) instead of blocking
// forever with no columns added.

import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PostgresQueryClient } from "../../types/postgres-query-client.js";
import type { SyncPlan } from "../../types/sync-plan.js";
import { SyncPlanExecutor } from "./execute-sync-plan.js";

const PG = "postgres://root:example@localhost:5432/default";
const schema = `sync_lock_${randomBytes(6).toString("hex")}`;

const wrap = (raw: Client): PostgresQueryClient => ({
  query: (async (sql: string, params?: Array<unknown>) => {
    const r = await raw.query(sql, params);
    return { rows: r.rows, rowCount: r.rowCount ?? 0 };
  }) as PostgresQueryClient["query"],
});

const addColumnPlan = (col: string): SyncPlan => ({
  operations: [
    {
      type: "add_column",
      severity: "safe",
      schema,
      table: "Locked",
      description: `Add column "${col}" to "${schema}"."Locked"`,
      sql: `ALTER TABLE "${schema}"."Locked" ADD COLUMN "${col}" text;`,
      autocommit: false,
    },
  ],
  summary: { safe: 1, warning: 0, destructive: 0, total: 1 },
});

const columnExists = async (raw: Client, col: string): Promise<boolean> => {
  const { rows } = await raw.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'Locked' AND column_name = $2`,
    [schema, col],
  );
  return rows.length > 0;
};

let exec: Client; // the "sync" connection
let holder: Client; // a peer that holds a conflicting lock
let admin: Client; // schema setup + inspection

describe("Postgres: synchronize lock-timeout", () => {
  beforeAll(async () => {
    admin = new Client({ connectionString: PG });
    exec = new Client({ connectionString: PG });
    holder = new Client({ connectionString: PG });
    await Promise.all([admin.connect(), exec.connect(), holder.connect()]);

    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`CREATE TABLE "${schema}"."Locked" ("id" text PRIMARY KEY)`);
    await admin.query(`INSERT INTO "${schema}"."Locked" ("id") VALUES ('a')`);
  });

  afterAll(async () => {
    try {
      await holder.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await Promise.all([admin.end(), exec.end(), holder.end()]);
  });

  beforeEach(async () => {
    // Ensure no lingering transaction/lock from a prior test.
    try {
      await holder.query("ROLLBACK");
    } catch {
      /* ignore */
    }
  });

  it("aborts fast with an actionable error while a peer holds the lock", async () => {
    // Peer grabs an ACCESS EXCLUSIVE lock and never commits — the sync's
    // ALTER TABLE can never acquire its own ACCESS EXCLUSIVE lock.
    await holder.query("BEGIN");
    await holder.query(`LOCK TABLE "${schema}"."Locked" IN ACCESS EXCLUSIVE MODE`);

    const executor = new SyncPlanExecutor(undefined, schema);
    const start = Date.now();

    let caught: any;
    try {
      await executor.execute(wrap(exec), addColumnPlan("c1"), { lockTimeout: 500 });
    } catch (err) {
      caught = err;
    }
    const elapsed = Date.now() - start;

    // Aborted (did not hang), fast (bounded by lock_timeout, not indefinite).
    expect(caught).toBeDefined();
    expect(caught.code).toBe("sync_lock_timeout");
    expect(elapsed).toBeLessThan(5000);

    // The error names the blocking session (best-effort diagnostics).
    expect(Array.isArray(caught.data?.blockers)).toBe(true);
    expect(caught.data.blockers.length).toBeGreaterThanOrEqual(1);

    // Crucially: no column was added (the transaction rolled back).
    await holder.query("ROLLBACK");
    expect(await columnExists(admin, "c1")).toBe(false);
  });

  it("adds the column normally when there is no contention", async () => {
    const executor = new SyncPlanExecutor(undefined, schema);
    const result = await executor.execute(wrap(exec), addColumnPlan("c2"), {
      lockTimeout: 500,
    });

    expect(result.executed).toBe(true);
    expect(result.statementsExecuted).toBe(1);
    expect(await columnExists(admin, "c2")).toBe(true);
  });

  it("waits indefinitely when lockTimeout is 0 (opt-out), then succeeds once released", async () => {
    await holder.query("BEGIN");
    await holder.query(`LOCK TABLE "${schema}"."Locked" IN ACCESS EXCLUSIVE MODE`);

    const executor = new SyncPlanExecutor(undefined, schema);
    let settled = false;
    const run = executor
      .execute(wrap(exec), addColumnPlan("c3"), { lockTimeout: 0 })
      .then((r) => {
        settled = true;
        return r;
      });

    // With no lock_timeout it must still be blocked after a beat.
    await new Promise((r) => setTimeout(r, 750));
    expect(settled).toBe(false);

    // Releasing the peer lets it proceed to completion.
    await holder.query("ROLLBACK");
    const result = await run;
    expect(result.executed).toBe(true);
    expect(await columnExists(admin, "c3")).toBe(true);
  });
});
