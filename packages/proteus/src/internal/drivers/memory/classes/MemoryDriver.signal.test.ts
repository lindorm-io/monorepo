/**
 * Unit tests for session-level AbortSignal on MemoryDriver.
 *
 * The memory driver is synchronous and in-process; mid-query cancellation
 * isn't meaningful. We only assert pre-flight: if the session signal is
 * aborted, entry points throw `AbortError` carrying the reason. Non-signal
 * sessions keep working.
 */

import { AbortError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test, type Mock, vi } from "vitest";
import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { makeField } from "../../../__fixtures__/make-field.js";
import { MemoryDriver } from "./MemoryDriver.js";

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
  const driver = new MemoryDriver(
    { driver: "memory" } as any,
    logger,
    null,
    resolveMetadata,
  );
  return { driver, logger, resolveMetadata };
};

const withSession = (
  driver: MemoryDriver,
  signal: AbortSignal | undefined,
): MemoryDriver =>
  driver.cloneWithGetters(
    () => new Map(),
    async (): Promise<void> => {},
    signal,
  );

describe("MemoryDriver + AbortSignal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  describe("non-signal session — unchanged behaviour", () => {
    test("beginTransaction resolves when no signal", async () => {
      const { driver } = makeDriver();
      const session = withSession(driver, undefined);
      const handle = await session.beginTransaction();
      expect(handle).toBeDefined();
    });

    test("checkSignal is a no-op when no signal is attached", () => {
      const { driver } = makeDriver();
      const session = withSession(driver, undefined);
      // Private hook is a no-op; safe to call any number of times.
      expect(() => (session as any).checkSignal()).not.toThrow();
    });
  });

  describe("non-aborted signal — executes normally", () => {
    test("live signal does not trip pre-flight", async () => {
      const { driver } = makeDriver();
      const controller = new AbortController();
      const session = withSession(driver, controller.signal);
      // Signal is live (not aborted) — pre-flight should pass.
      expect(() => (session as any).checkSignal()).not.toThrow();
      await expect(session.beginTransaction()).resolves.toBeDefined();
    });
  });
});

// Suppress unused-import warnings for mocked types
void (undefined as unknown as Mock);
