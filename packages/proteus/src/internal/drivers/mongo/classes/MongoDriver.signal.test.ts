/**
 * Unit tests for session-level AbortSignal on MongoDriver.
 *
 * Mongo cancellation is split:
 * - Driver entry points run a pre-flight signal check.
 * - MongoExecutor forwards `signal` into read methods (find / findOne /
 *   countDocuments / aggregate) which mongodb v7 exposes as `Abortable`.
 * - Write methods (insertOne / updateMany / deleteMany) don't accept a
 *   signal in mongodb v7 typings, so writes rely on pre-flight only.
 *
 * Integration coverage (real replica set) lives in MongoDriver.signal.integration.test.ts.
 */

import { AbortError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { classifyMongoError } from "../utils/classify-breaker-error.js";
import { makeField } from "../../../__fixtures__/make-field.js";
import { MongoDriver } from "./MongoDriver.js";

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
  const driver = new MongoDriver(
    { driver: "mongo", url: "mongodb://localhost:27017/test" } as any,
    logger,
    null,
    resolveMetadata,
  );
  // Inject a stub db so requireDb() does not throw.
  (driver as any).db = {
    collection: vi.fn().mockReturnValue({
      find: vi.fn(),
      findOne: vi.fn(),
      countDocuments: vi.fn(),
      aggregate: vi.fn(),
    }),
  };
  (driver as any).isReplicaSet = true;
  return { driver, logger, resolveMetadata };
};

const withSession = (driver: MongoDriver, signal: AbortSignal | undefined): MongoDriver =>
  driver.cloneWithGetters(
    () => new Map(),
    async (): Promise<void> => {},
    signal,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MongoDriver + AbortSignal", () => {
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
    test("pre-flight is a no-op when no signal is attached", () => {
      const { driver } = makeDriver();
      const session = withSession(driver, undefined);
      expect(() => (session as any).checkSignal()).not.toThrow();
    });
  });

  describe("BreakerExecutor + AbortError classification", () => {
    test("AbortError is classified as ignorable (does not trip the breaker)", () => {
      const err = new AbortError("cancelled", { reason: { kind: "manual" } });
      expect(classifyMongoError(err)).toBe("ignorable");
    });
  });
});
