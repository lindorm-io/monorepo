/**
 * Integration tests for the Tier 3 pg cancellation path. Runs against the
 * docker-composed Postgres instance (see packages/proteus/docker-compose.yml).
 *
 * Coverage:
 * - SELECT pg_sleep(5) with abort at ~100ms rejects as AbortError in <500ms;
 *   the backend pid is no longer running the sleep.
 * - Abort inside withImplicitTransaction rolls back; the pool stays healthy.
 * - Abort during withTransaction + retry does not dispatch a second attempt.
 * - A burst of 10 aborts does NOT open the circuit breaker.
 */

import { AbortError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { randomBytes } from "node:crypto";
import { Client } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { CircuitBreaker } from "@lindorm/breaker";
import { PostgresDriver } from "./PostgresDriver.js";
import { classifyPostgresError } from "../utils/classify-breaker-error.js";
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata.js";

const PG_CONNECTION = "postgres://root:example@localhost:5432/default";
const schema = `test_sig_${randomBytes(6).toString("hex")}`;

describe("PostgresDriver cancellation (integration)", () => {
  let raw: Client;
  let driver: PostgresDriver;

  beforeAll(async () => {
    raw = new Client({ connectionString: PG_CONNECTION });
    await raw.connect();
    await raw.query(`CREATE SCHEMA "${schema}"`);
  });

  afterAll(async () => {
    await raw.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await raw.end();
  });

  beforeEach(async () => {
    driver = new PostgresDriver(
      { driver: "postgres", url: PG_CONNECTION, logger: createMockLogger() },
      createMockLogger(),
      schema,
      getEntityMetadata,
    );
    await driver.connect();
  });

  afterEach(async () => {
    await driver.disconnect();
  });

  // ─── pg_sleep cancellation ──────────────────────────────────────────────────

  test("aborts a long-running query within 500ms via pg_cancel_backend", async () => {
    const controller = new AbortController();
    const session = driver.cloneWithGetters(
      () => new Map(),
      async () => {},
      controller.signal,
    );

    // Kick off pg_sleep(5) via the session's signal-aware client. Abort at
    // ~100ms and assert the promise rejects in <500ms with AbortError.
    const start = Date.now();
    const client = (session as any).createPgClientFromPoolWithSignal(
      (session as any).pool,
      controller.signal,
    );

    const pending = client
      .query("SELECT pg_sleep(5)")
      .then(() => ({ ok: true as const }))
      .catch((err: unknown) => ({ ok: false as const, err }));

    setTimeout(() => controller.abort({ kind: "client-disconnect" }), 100);
    const result = await pending;
    const elapsed = Date.now() - start;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.err).toBeInstanceOf(AbortError);
    }
    expect(elapsed).toBeLessThan(500);

    // pg_stat_activity should no longer show the sleep running. pg_cancel_backend
    // is asynchronous — poll briefly to let the backend settle.
    const pollActive = async (): Promise<number> => {
      for (let i = 0; i < 20; i += 1) {
        const rows = await raw.query(
          `SELECT pid FROM pg_stat_activity WHERE query LIKE '%pg_sleep(5)%' AND state = 'active' AND pid <> pg_backend_pid()`,
        );
        if (rows.rowCount === 0) return 0;
        await new Promise((r) => setTimeout(r, 50));
      }
      return -1;
    };
    expect(await pollActive()).toBe(0);
  });

  // ─── withImplicitTransaction rollback on abort ──────────────────────────────

  test("abort inside withImplicitTransaction rolls back and leaves pool healthy", async () => {
    const tableName = `t_${randomBytes(4).toString("hex")}`;
    await raw.query(
      `CREATE TABLE "${schema}"."${tableName}" (id serial PRIMARY KEY, val int)`,
    );
    await raw.query(`INSERT INTO "${schema}"."${tableName}" (val) VALUES (1)`);

    const controller = new AbortController();
    const session = driver.cloneWithGetters(
      () => new Map(),
      async () => {},
      controller.signal,
    );

    // Build the withImplicitTransaction closure using private API — a real
    // repository requires a full entity registration which is overkill for
    // this assertion. We test the cancellation semantics of the closure.
    const pool = (session as any).pool;
    const sessionSignal = controller.signal;

    const withImplicit = async (fn: (ctx: { client: any }) => Promise<unknown>) => {
      if (sessionSignal?.aborted) {
        throw new AbortError("already aborted", { reason: sessionSignal.reason });
      }
      const poolClient = await pool.connect();
      const disposeListener = sessionSignal
        ? (session as any).attachPoolClientAbortListener(poolClient, sessionSignal)
        : null;
      const txClient = (session as any).createPgClient(poolClient, sessionSignal);
      try {
        await txClient.query("BEGIN");
        const result = await fn({ client: txClient });
        await txClient.query("COMMIT");
        return result;
      } catch (error) {
        try {
          await txClient.query("ROLLBACK");
        } catch {
          /* ignore */
        }
        throw error;
      } finally {
        disposeListener?.();
        poolClient.release();
      }
    };

    const pending = withImplicit(async ({ client }) => {
      await client.query(`UPDATE "${schema}"."${tableName}" SET val = 99 WHERE id = 1`);
      // Long-running second statement that will be cancelled.
      await client.query("SELECT pg_sleep(5)");
    }).catch((err) => err);

    setTimeout(() => controller.abort({ kind: "client-disconnect" }), 100);
    const err = await pending;

    expect(err).toBeInstanceOf(AbortError);

    // Row must still be 1 — UPDATE was rolled back.
    const { rows } = await raw.query(
      `SELECT val FROM "${schema}"."${tableName}" WHERE id = 1`,
    );
    expect(rows[0].val).toBe(1);

    // Pool is still healthy — run another query via a fresh session.
    const ok = await driver.query<{ ok: number }>("SELECT 1 AS ok");
    expect(ok.rows[0].ok).toBe(1);
  });

  // ─── withTransaction retry short-circuit ────────────────────────────────────

  test("withTransaction + retry: no second attempt after abort", async () => {
    const controller = new AbortController();
    const session = driver.cloneWithGetters(
      () => new Map(),
      async () => {},
      controller.signal,
    );

    let attempts = 0;

    const pending = session
      .withTransaction(
        async (_ctx) => {
          attempts += 1;
          // Simulate a serialization failure during the first attempt — the
          // retry path would normally re-run the callback.
          controller.abort({ kind: "client-disconnect" });
          const err: any = new Error("could not serialize access");
          err.code = "40001";
          throw err;
        },
        { retry: { maxRetries: 3, initialDelayMs: 10 } as any },
      )
      .catch((e) => e);

    const err = await pending;
    expect(err).toBeTruthy();
    expect(attempts).toBe(1);
  });

  // ─── Circuit breaker + abort storm ──────────────────────────────────────────

  test("10 aborts in a row do NOT open the circuit breaker", async () => {
    const breaker = new CircuitBreaker({
      name: "proteus-abort-test",
      classifier: classifyPostgresError,
      threshold: 3,
    });

    const abortDriver = new PostgresDriver(
      { driver: "postgres", url: PG_CONNECTION, logger: createMockLogger() },
      createMockLogger(),
      schema,
      getEntityMetadata,
      undefined,
      undefined,
      undefined,
      breaker,
    );
    await abortDriver.connect();

    try {
      for (let i = 0; i < 10; i += 1) {
        const controller = new AbortController();
        const session = abortDriver.cloneWithGetters(
          () => new Map(),
          async () => {},
          controller.signal,
        );
        const client = (session as any).createPgClientFromPoolWithSignal(
          (session as any).pool,
          controller.signal,
        );

        const pending = client
          .query("SELECT pg_sleep(2)")
          .then(() => null)
          .catch((err: unknown) => err);
        setTimeout(() => controller.abort({ kind: "client-disconnect" }), 50);
        const err = await pending;

        // Feed the classifier what the BreakerExecutor would feed it.
        if (err instanceof Error) {
          await breaker.execute(() => Promise.reject(err)).catch(() => {});
        }
      }

      expect(breaker.state).toBe("closed");
    } finally {
      await abortDriver.disconnect();
    }
  }, 30_000);
});
