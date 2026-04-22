/**
 * Integration tests for session-level AbortSignal on RedisDriver.
 * Runs against the docker-composed redis instance (see
 * packages/proteus/docker-compose.yml).
 *
 * Coverage:
 * - Pre-flight: aborted session rejects commands before dispatching.
 * - raceWithSignal rejects the caller while a blocking command is pending.
 * - Non-signal session — normal commands go through unchanged.
 */

import { AbortError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import Redis from "ioredis";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { RedisDriver } from "./RedisDriver.js";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const REDIS_HOST = process.env["REDIS_HOST"] ?? "127.0.0.1";
const REDIS_PORT = Number(process.env["REDIS_PORT"] ?? 6379);

describe("RedisDriver cancellation (integration)", () => {
  let driver: RedisDriver;

  beforeAll(async () => {
    // Wait for redis to be ready.
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const probe = new Redis({
          host: REDIS_HOST,
          port: REDIS_PORT,
          lazyConnect: true,
          maxRetriesPerRequest: 0,
        });
        await probe.connect();
        await probe.ping();
        await probe.quit();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    driver = new RedisDriver(
      { driver: "redis", host: REDIS_HOST, port: REDIS_PORT } as any,
      createMockLogger(),
      null,
      (() => ({}) as any) as any,
    );
    await driver.connect();
  });

  afterAll(async () => {
    await driver.disconnect();
  });

  test("pre-flight: aborted session rejects createExecutor with AbortError", () => {
    const controller = new AbortController();
    controller.abort({ kind: "client-disconnect" });
    const session = driver.cloneWithGetters(
      () => new Map(),
      async () => {},
      controller.signal,
    );

    class Dummy {
      [k: string]: unknown;
    }
    expect(() => session.createExecutor(Dummy as any)).toThrow(AbortError);
  });

  test("raceWithSignal rejects the caller while BLPOP waits", async () => {
    const controller = new AbortController();
    const session = driver.cloneWithGetters(
      () => new Map(),
      async () => {},
      controller.signal,
    );

    // BLPOP blocks until an element arrives or the timeout elapses. 5s is
    // long enough to give us a window to abort. The ioredis command stays
    // in-flight; raceWithSignal just unwinds the caller.
    const client = (session as any).client as Redis;
    const start = Date.now();
    const pending = (session as any)
      .raceWithSignal(client.blpop("proteus_sig_nonexistent", 5))
      .then(() => ({ ok: true as const }))
      .catch((err: unknown) => ({ ok: false as const, err }));

    setTimeout(() => controller.abort({ kind: "client-disconnect" }), 150);
    const result = await pending;
    const elapsed = Date.now() - start;

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.err).toBeInstanceOf(AbortError);
    expect(elapsed).toBeLessThan(1500);

    // Issue a non-blocking command to confirm the client is still healthy.
    expect(await client.ping()).toBe("PONG");
  });

  test("non-signal session — PING returns PONG", async () => {
    const session = driver.cloneWithGetters(
      () => new Map(),
      async () => {},
      undefined,
    );
    const client = (session as any).client as Redis;
    expect(await client.ping()).toBe("PONG");
  });
});
