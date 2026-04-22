/**
 * Unit tests for session-level AbortSignal on RedisDriver.
 *
 * ioredis has no native AbortSignal support. The driver honours the
 * session signal in two layers:
 *   - Pre-flight at every public entry point throws AbortError when the
 *     session has been cancelled before the command runs.
 *   - A private `raceWithSignal` helper races a pending ioredis command
 *     against the signal; the command still lands on the wire but the
 *     caller unwinds promptly.
 */

import { AbortError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { classifyRedisError } from "../utils/classify-breaker-error.js";
import { makeField } from "../../../__fixtures__/make-field.js";
import { RedisDriver } from "./RedisDriver.js";

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

const makeDriver = () => {
  const logger = createMockLogger();
  const resolveMetadata = vi
    .fn<(t: Constructor<IEntity>) => EntityMetadata>()
    .mockReturnValue(mockMetadata);
  const driver = new RedisDriver(
    { driver: "redis" } as any,
    logger,
    null,
    resolveMetadata,
  );
  // Inject a stub client so requireClient() does not throw.
  (driver as any).client = { get: vi.fn(), set: vi.fn(), ping: vi.fn() };
  return { driver, logger, resolveMetadata };
};

const withSession = (driver: RedisDriver, signal: AbortSignal | undefined): RedisDriver =>
  driver.cloneWithGetters(
    () => new Map(),
    async (): Promise<void> => {},
    signal,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RedisDriver + AbortSignal", () => {
  describe("cloneWithGetters", () => {
    test("stores the session signal on the clone", () => {
      const { driver } = makeDriver();
      const controller = new AbortController();
      const session = withSession(driver, controller.signal);
      expect((session as any).signal).toBe(controller.signal);
    });

    test("signal defaults to undefined when not provided", () => {
      const { driver } = makeDriver();
      const session = withSession(driver, undefined);
      expect((session as any).signal).toBeUndefined();
    });
  });

  describe("pre-flight — aborted session", () => {
    test("createRepository throws AbortError with the signal reason", () => {
      const { driver } = makeDriver();
      const reason = { kind: "client-disconnect" as const };
      const controller = new AbortController();
      controller.abort(reason);
      const session = withSession(driver, controller.signal);

      try {
        session.createRepository(TestEntity);
        throw new Error("unreachable");
      } catch (err) {
        expect(err).toBeInstanceOf(AbortError);
        expect((err as AbortError).reason).toBe(reason);
      }
    });

    test("createExecutor throws AbortError", () => {
      const { driver } = makeDriver();
      const controller = new AbortController();
      controller.abort({ kind: "manual" });
      const session = withSession(driver, controller.signal);
      expect(() => session.createExecutor(TestEntity)).toThrow(AbortError);
    });

    test("createQueryBuilder throws AbortError", () => {
      const { driver } = makeDriver();
      const controller = new AbortController();
      controller.abort({ kind: "manual" });
      const session = withSession(driver, controller.signal);
      expect(() => session.createQueryBuilder(TestEntity)).toThrow(AbortError);
    });

    test("beginTransaction rejects with AbortError", async () => {
      const { driver } = makeDriver();
      const controller = new AbortController();
      controller.abort({ kind: "manual" });
      const session = withSession(driver, controller.signal);
      await expect(session.beginTransaction()).rejects.toBeInstanceOf(AbortError);
    });

    test("withTransaction rejects with AbortError before invoking the callback", async () => {
      const { driver } = makeDriver();
      const controller = new AbortController();
      controller.abort({ kind: "manual" });
      const session = withSession(driver, controller.signal);
      const cb = vi.fn().mockResolvedValue("never");
      await expect(session.withTransaction(cb as any)).rejects.toBeInstanceOf(AbortError);
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe("raceWithSignal", () => {
    test("passes through when no signal is set", async () => {
      const { driver } = makeDriver();
      const session = withSession(driver, undefined);
      const result = await (session as any).raceWithSignal(Promise.resolve("ok"));
      expect(result).toBe("ok");
    });

    test("rejects immediately when signal is already aborted", async () => {
      const { driver } = makeDriver();
      const controller = new AbortController();
      controller.abort({ kind: "manual" });
      const session = withSession(driver, controller.signal);

      await expect(
        (session as any).raceWithSignal(new Promise(() => {})),
      ).rejects.toBeInstanceOf(AbortError);
    });

    test("resolves when command finishes before abort", async () => {
      const { driver } = makeDriver();
      const controller = new AbortController();
      const session = withSession(driver, controller.signal);

      const result = await (session as any).raceWithSignal(Promise.resolve(42));
      expect(result).toBe(42);
    });

    test("rejects with AbortError when abort fires before the command resolves", async () => {
      const { driver } = makeDriver();
      const controller = new AbortController();
      const session = withSession(driver, controller.signal);

      let resolveCmd!: (v: unknown) => void;
      const cmd = new Promise((resolve) => {
        resolveCmd = resolve;
      });

      const pending = (session as any).raceWithSignal(cmd);
      controller.abort({ kind: "client-disconnect" });
      await expect(pending).rejects.toBeInstanceOf(AbortError);
      // The underlying command still completes in the background — the
      // race just unwound the caller. Resolve it to avoid an unhandled
      // promise warning.
      resolveCmd("late");
    });

    test("carries the signal reason on abort", async () => {
      const { driver } = makeDriver();
      const reason = { kind: "request-timeout" as const, timeoutMs: 5000 };
      const controller = new AbortController();
      const session = withSession(driver, controller.signal);

      const pending = (session as any).raceWithSignal(new Promise(() => {}));
      controller.abort(reason);
      try {
        await pending;
        throw new Error("unreachable");
      } catch (err) {
        expect(err).toBeInstanceOf(AbortError);
        expect((err as AbortError).reason).toBe(reason);
      }
    });

    test("listener is removed after the command resolves", async () => {
      const { driver } = makeDriver();
      const controller = new AbortController();
      const session = withSession(driver, controller.signal);

      const removeSpy = vi.spyOn(controller.signal, "removeEventListener");
      await (session as any).raceWithSignal(Promise.resolve(1));
      expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
    });

    test("listener is removed after the command rejects", async () => {
      const { driver } = makeDriver();
      const controller = new AbortController();
      const session = withSession(driver, controller.signal);

      const removeSpy = vi.spyOn(controller.signal, "removeEventListener");
      await expect(
        (session as any).raceWithSignal(Promise.reject(new Error("boom"))),
      ).rejects.toThrow("boom");
      expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
    });
  });

  describe("non-signal session — unchanged behaviour", () => {
    test("pre-flight is a no-op when no signal is attached", () => {
      const { driver } = makeDriver();
      const session = withSession(driver, undefined);
      expect(() => (session as any).checkSignal()).not.toThrow();
    });
  });

  describe("BreakerExecutor + AbortError classification", () => {
    test("AbortError is classified as ignorable (does not trip the breaker)", () => {
      const err = new AbortError("cancelled", { reason: { kind: "manual" } });
      expect(classifyRedisError(err)).toBe("ignorable");
    });
  });
});
