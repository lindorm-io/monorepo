/**
 * End-to-end test for Phase 3 of the cancellation-signals feature.
 *
 * Exercises the full abort flow: real Pylon HTTP server → dependencies
 * middleware → real ProteusSource (Postgres) → signal-aware transaction
 * path → server-side pg_cancel_backend.
 *
 * Requires the docker-composed Postgres (see docker-compose.yml at the
 * package root — brought up automatically by `npm test`).
 */

import { createMockAmphora } from "@lindorm/amphora/mocks/vitest";
import { AbortError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusSource } from "@lindorm/proteus";
import http from "http";
import type { AddressInfo } from "net";
import { Client } from "pg";
import { PylonHttp } from "./PylonHttp.js";
import { PylonRouter } from "./PylonRouter.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const PG_CONNECTION = "postgres://root:example@localhost:5432/default";

describe("PylonHttp + ProteusSource abort-flow end-to-end", () => {
  let pylonHttp: PylonHttp;
  let proteus: ProteusSource;
  let server: http.Server;
  let baseUrl: string;
  let raw: Client;

  // State shared between handler and assertions.
  const captured: {
    sleepPid?: number;
    handlerStart?: number;
    handlerEnd?: number;
    handlerError?: unknown;
  } = {};

  beforeAll(async () => {
    // Raw pg Client for pg_stat_activity introspection and cleanup.
    raw = new Client({ connectionString: PG_CONNECTION });
    await raw.connect();

    proteus = new ProteusSource({
      driver: "postgres",
      url: PG_CONNECTION,
      logger: createMockLogger(),
    });
    await proteus.connect();

    const router = new PylonRouter();

    // Long-running route — issues pg_sleep(5) inside a proteus transaction.
    // The transaction path wires the session's AbortSignal into the
    // PoolClient, so a client-disconnect aborts the statement server-side.
    router.get("/sleep", async (ctx) => {
      captured.handlerStart = Date.now();
      try {
        await ctx.proteus!.transaction(async (tx) => {
          // Capture the backend pid first so assertions can target it.
          const pidRows = await (tx as any).handle.client.query(
            "SELECT pg_backend_pid() AS pid",
          );
          captured.sleepPid = pidRows.rows[0].pid;
          // Now run the long-running query. This is what gets cancelled.
          await (tx as any).handle.client.query("SELECT pg_sleep(5)");
        });
        ctx.status = 200;
        ctx.body = { ok: true };
      } catch (error) {
        captured.handlerError = error;
        throw error;
      } finally {
        captured.handlerEnd = Date.now();
      }
    });

    // Short route — verifies the pool is healthy after an abort.
    router.get("/ok", async (ctx) => {
      const rows = await ctx.proteus!.transaction(async (tx) => {
        const result = await (tx as any).handle.client.query("SELECT 1 AS ok");
        return result.rows;
      });
      ctx.status = 200;
      ctx.body = { rows };
    });

    pylonHttp = new PylonHttp({
      amphora: createMockAmphora() as any,
      logger: createMockLogger(),
      proteus,
      routes: { path: "/e2e", router },
    });

    pylonHttp.loadMiddleware();
    await pylonHttp.loadRouters();

    server = http.createServer(pylonHttp.callback);

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await proteus.disconnect();
    await raw.end();
  });

  test("aborting the HTTP request cancels the in-flight pg query and leaves the pool healthy", async () => {
    const controller = new AbortController();

    const fetchPromise = fetch(`${baseUrl}/e2e/sleep`, {
      signal: controller.signal,
    });

    // Wait until the handler has started the sleep — pid is set by the
    // first in-transaction query before pg_sleep fires.
    await new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + 3000;
      const check = setInterval(() => {
        if (captured.sleepPid != null) {
          clearInterval(check);
          resolve();
          return;
        }
        if (Date.now() > deadline) {
          clearInterval(check);
          reject(new Error("Handler did not start sleep query in time"));
        }
      }, 10);
    });

    const abortAt = Date.now();
    controller.abort();

    // The client-side fetch must reject.
    await expect(fetchPromise).rejects.toThrow();

    // Poll until the handler has fully unwound, with a hard ceiling.
    await new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + 2000;
      const check = setInterval(() => {
        if (captured.handlerEnd != null) {
          clearInterval(check);
          resolve();
          return;
        }
        if (Date.now() > deadline) {
          clearInterval(check);
          reject(new Error("Handler did not unwind in time"));
        }
      }, 10);
    });

    // Assertion 1 — handler unwinds within 1s of the abort.
    const unwindMs = captured.handlerEnd! - abortAt;
    expect(unwindMs).toBeLessThan(1000);

    // Assertion 2 — the handler rejected with AbortError (rewrapped 57014).
    expect(captured.handlerError).toBeInstanceOf(AbortError);

    // Assertion 3 — pg_stat_activity no longer shows the sleep backend
    // running pg_sleep. pg_cancel_backend is asynchronous, so poll briefly.
    const pollActive = async (): Promise<number> => {
      for (let i = 0; i < 20; i += 1) {
        const rows = await raw.query(
          `SELECT pid FROM pg_stat_activity
           WHERE pid = $1 AND state = 'active' AND query LIKE '%pg_sleep(5)%'`,
          [captured.sleepPid],
        );
        if (rows.rowCount === 0) return 0;
        await new Promise((r) => setTimeout(r, 50));
      }
      return -1;
    };
    expect(await pollActive()).toBe(0);

    // Assertion 4 — the pool is healthy. A fresh HTTP request, new
    // session, same ProteusSource, runs a normal query successfully.
    const okResponse = await fetch(`${baseUrl}/e2e/ok`);
    expect(okResponse.status).toBe(200);
    const body = (await okResponse.json()) as { rows: Array<{ ok: number }> };
    expect(body.rows[0].ok).toBe(1);
  }, 30_000);
});
