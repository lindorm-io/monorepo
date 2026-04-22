/**
 * Integration tests for the KILL QUERY cancellation path on MySqlDriver.
 * Runs against the docker-composed MySQL instance (see
 * packages/proteus/docker-compose.yml).
 *
 * Coverage:
 * - SELECT SLEEP(5) with abort at ~100ms rejects as AbortError in <1500ms;
 *   no connection leak (pool still healthy).
 * - withTransaction short-circuits when session is aborted.
 */

import { AbortError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { randomBytes } from "node:crypto";
import mysql from "mysql2/promise";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { MySqlDriver } from "./MySqlDriver.js";
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata.js";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const MYSQL_HOST = process.env["MYSQL_HOST"] ?? "127.0.0.1";
const MYSQL_PORT = Number(process.env["MYSQL_PORT"] ?? 3306);
const MYSQL_USER = "root";
const MYSQL_PASSWORD = "example";
const MYSQL_DATABASE = `sig_${randomBytes(6).toString("hex")}`;

describe("MySqlDriver cancellation (integration)", () => {
  let raw: mysql.Connection;
  let driver: MySqlDriver;

  beforeAll(async () => {
    // Wait for MySQL to be ready
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        const probe = await mysql.createConnection({
          host: MYSQL_HOST,
          port: MYSQL_PORT,
          user: MYSQL_USER,
          password: MYSQL_PASSWORD,
          connectTimeout: 1000,
        });
        await probe.execute("SELECT 1");
        await probe.end();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    raw = await mysql.createConnection({
      host: MYSQL_HOST,
      port: MYSQL_PORT,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
    });
    await raw.query(`CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\``);
  });

  afterAll(async () => {
    try {
      await raw.query(`DROP DATABASE IF EXISTS \`${MYSQL_DATABASE}\``);
    } finally {
      await raw.end();
    }
  });

  beforeEach(async () => {
    driver = new MySqlDriver(
      {
        driver: "mysql",
        host: MYSQL_HOST,
        port: MYSQL_PORT,
        user: MYSQL_USER,
        password: MYSQL_PASSWORD,
        database: MYSQL_DATABASE,
      } as any,
      createMockLogger(),
      null,
      getEntityMetadata as any,
    );
    await driver.connect();
  });

  afterEach(async () => {
    await driver.disconnect();
  });

  test("aborts a long-running query within ~1500ms via KILL QUERY", async () => {
    const controller = new AbortController();
    const session = driver.cloneWithGetters(
      () => new Map(),
      async () => {},
      controller.signal,
    );

    const start = Date.now();
    const client = (session as any).createMysqlClientFromPoolWithSignal(
      (session as any).pool,
      controller.signal,
    );

    // Start the sleep and schedule the abort. 100ms is enough to let
    // mysql2 dispatch the statement to the server. If the driver never
    // issues KILL QUERY, the SELECT SLEEP(5) resolves after ~5s. The
    // listener fires KILL QUERY which returns ER_QUERY_INTERRUPTED well
    // before that.
    const pending = client
      .query("SELECT SLEEP(5)")
      .then((val: unknown) => ({ ok: true as const, val }))
      .catch((err: unknown) => ({ ok: false as const, err }));

    setTimeout(() => controller.abort({ kind: "client-disconnect" }), 100);
    const result = await pending;
    const elapsed = Date.now() - start;

    if (result.ok) {
      throw new Error(
        `expected abort to reject the query — it resolved after ${elapsed}ms: ${JSON.stringify(
          result.val,
        )}`,
      );
    }
    expect(result.err).toBeInstanceOf(AbortError);
    // KILL QUERY through a separate connection — network plus mysql dispatch
    // time is well under 1500ms in practice.
    expect(elapsed).toBeLessThan(1500);

    // Pool should be healthy after the kill — issue a follow-up query.
    const nextClient = (session as any).createMysqlClientFromPool((session as any).pool);
    const res = await nextClient.query("SELECT 1 AS one");
    expect(res.rows[0]).toEqual({ one: 1 });
  });

  test("pre-flight: aborted session rejects before acquiring pool", async () => {
    const controller = new AbortController();
    controller.abort({ kind: "client-disconnect" });
    const session = driver.cloneWithGetters(
      () => new Map(),
      async () => {},
      controller.signal,
    );

    await expect(session.query("SELECT 1")).rejects.toBeInstanceOf(AbortError);
  });

  test("withTransaction short-circuits when signal is aborted before first attempt", async () => {
    const controller = new AbortController();
    controller.abort({ kind: "client-disconnect" });
    const session = driver.cloneWithGetters(
      () => new Map(),
      async () => {},
      controller.signal,
    );

    await expect(session.withTransaction(async () => "never")).rejects.toBeInstanceOf(
      AbortError,
    );
  });

  test("non-signal session — query executes normally", async () => {
    const session = driver.cloneWithGetters(
      () => new Map(),
      async () => {},
      undefined,
    );
    const result = await session.query<{ one: number }>("SELECT 1 AS one");
    expect(result.rows[0]).toEqual({ one: 1 });
  });

  test("tx.client<MysqlQueryClient>() runs a raw query inside an active tx", async () => {
    const session = driver.cloneWithGetters(
      () => new Map(),
      async () => {},
    );

    const result = await session.withTransaction(async (ctx) => {
      const client = await ctx.client<{
        query: (sql: string) => Promise<{ rows: Array<{ n: number }> }>;
      }>();
      const { rows } = await client.query("SELECT 1 AS n");
      return rows[0].n;
    });

    expect(result).toBe(1);
  });
});
