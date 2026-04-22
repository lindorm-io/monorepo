/**
 * Unit tests for session-level AbortSignal on SqliteDriver.
 *
 * better-sqlite3 runs synchronously on the event-loop thread — mid-query
 * cancellation isn't possible. We only assert pre-flight: if the session
 * signal is aborted, the entry points throw `AbortError` carrying the
 * reason. Non-signal sessions keep working.
 */

import { AbortError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { makeField } from "../../../__fixtures__/make-field.js";
import { SqliteDriver } from "./SqliteDriver.js";

class TestEntity implements IEntity {
  [key: string]: any;
  id!: string;
}

const mockMetadata = {
  entity: { name: "TestEntity" },
  fields: [makeField("id")],
  primaryKeys: ["id"],
  relations: [],
  generated: [],
  embeddedLists: [],
  indexes: [],
} as unknown as EntityMetadata;

const makeDriver = async (): Promise<{
  driver: SqliteDriver;
  cleanup: () => Promise<void>;
}> => {
  const logger = createMockLogger();
  const resolveMetadata = vi
    .fn<(t: Constructor<IEntity>) => EntityMetadata>()
    .mockReturnValue(mockMetadata);
  const filename = join(tmpdir(), `proteus-sig-${randomUUID()}.db`);
  const driver = new SqliteDriver(
    { driver: "sqlite", filename } as any,
    logger,
    null,
    resolveMetadata,
  );
  await driver.connect();
  const cleanup = async (): Promise<void> => {
    await driver.disconnect();
    await rm(filename, { force: true });
  };
  return { driver, cleanup };
};

const withSession = (
  driver: SqliteDriver,
  signal: AbortSignal | undefined,
): SqliteDriver =>
  driver.cloneWithGetters(
    () => new Map(),
    async (): Promise<void> => {},
    signal,
  );

describe("SqliteDriver + AbortSignal", () => {
  let cleanup: () => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (cleanup) await cleanup();
  });

  describe("cloneWithGetters", () => {
    test("stores the session signal on the clone", async () => {
      const made = await makeDriver();
      cleanup = made.cleanup;
      const controller = new AbortController();
      const session = withSession(made.driver, controller.signal);
      expect((session as any).signal).toBe(controller.signal);
    });

    test("signal defaults to undefined when not provided", async () => {
      const made = await makeDriver();
      cleanup = made.cleanup;
      const session = withSession(made.driver, undefined);
      expect((session as any).signal).toBeUndefined();
    });
  });

  describe("pre-flight — aborted session", () => {
    test("query throws AbortError with the signal reason", async () => {
      const made = await makeDriver();
      cleanup = made.cleanup;
      const reason = { kind: "client-disconnect" as const };
      const controller = new AbortController();
      controller.abort(reason);
      const session = withSession(made.driver, controller.signal);

      try {
        await session.query("SELECT 1");
        throw new Error("unreachable");
      } catch (err) {
        expect(err).toBeInstanceOf(AbortError);
        expect((err as AbortError).reason).toBe(reason);
      }
    });

    test("createExecutor throws AbortError", async () => {
      const made = await makeDriver();
      cleanup = made.cleanup;
      const controller = new AbortController();
      controller.abort({ kind: "manual" });
      const session = withSession(made.driver, controller.signal);
      expect(() => session.createExecutor(TestEntity)).toThrow(AbortError);
    });

    test("createQueryBuilder throws AbortError", async () => {
      const made = await makeDriver();
      cleanup = made.cleanup;
      const controller = new AbortController();
      controller.abort({ kind: "manual" });
      const session = withSession(made.driver, controller.signal);
      expect(() => session.createQueryBuilder(TestEntity)).toThrow(AbortError);
    });

    test("beginTransaction rejects with AbortError", async () => {
      const made = await makeDriver();
      cleanup = made.cleanup;
      const controller = new AbortController();
      controller.abort({ kind: "manual" });
      const session = withSession(made.driver, controller.signal);
      await expect(session.beginTransaction()).rejects.toBeInstanceOf(AbortError);
    });

    test("withTransaction rejects with AbortError before invoking the callback", async () => {
      const made = await makeDriver();
      cleanup = made.cleanup;
      const controller = new AbortController();
      controller.abort({ kind: "manual" });
      const session = withSession(made.driver, controller.signal);
      const cb = vi.fn().mockResolvedValue("never");
      await expect(session.withTransaction(cb as any)).rejects.toBeInstanceOf(AbortError);
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe("non-signal session — unchanged behaviour", () => {
    test("query executes normally when no signal is attached", async () => {
      const made = await makeDriver();
      cleanup = made.cleanup;
      const session = withSession(made.driver, undefined);
      const result = await session.query("SELECT 1 AS one");
      expect(result.rows[0]).toEqual({ one: 1 });
    });

    test("beginTransaction resolves when no signal", async () => {
      const made = await makeDriver();
      cleanup = made.cleanup;
      const session = withSession(made.driver, undefined);
      const handle = await session.beginTransaction();
      expect(handle).toBeDefined();
      await session.rollbackTransaction(handle);
    });
  });

  describe("non-aborted signal — executes normally", () => {
    test("live signal does not trip pre-flight", async () => {
      const made = await makeDriver();
      cleanup = made.cleanup;
      const controller = new AbortController();
      const session = withSession(made.driver, controller.signal);
      const result = await session.query("SELECT 1 AS one");
      expect(result.rows[0]).toEqual({ one: 1 });
    });
  });
});
