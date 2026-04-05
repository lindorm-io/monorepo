import { createMockLogger } from "@lindorm/logger";
import type { ILogger } from "@lindorm/logger";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import type { ProteusRedisOptions } from "../../../../types";
import type { MetadataResolver } from "../../../interfaces/ProteusDriver";
import { NotSupportedError } from "../../../../errors/NotSupportedError";
import { RedisDriverError } from "../errors/RedisDriverError";
import { RedisDriver } from "./RedisDriver";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockQuit = jest.fn().mockResolvedValue("OK");
const mockPing = jest.fn().mockResolvedValue("PONG");

jest.mock("ioredis", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      connect: mockConnect,
      quit: mockQuit,
      ping: mockPing,
    })),
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const createBaseMetadata = (): EntityMetadata => ({
  target: class TestEntity {} as any,
  appendOnly: false,
  cache: null,
  checks: [],
  defaultOrder: null,
  embeddedLists: [],
  entity: { decorator: "Entity", comment: null, name: "TestEntity", namespace: null },
  extras: [],
  fields: [
    {
      key: "id",
      decorator: "Field",
      arrayType: null,
      collation: null,
      comment: null,
      computed: null,
      embedded: null,
      encrypted: null,
      enum: null,
      default: null,
      hideOn: [],
      max: null,
      min: null,
      name: "id",
      nullable: false,
      order: null,
      precision: null,
      readonly: false,
      scale: null,
      schema: null,
      transform: null,
      type: "uuid",
    },
  ],
  filters: [],
  generated: [],
  hooks: [],
  inheritance: null,
  indexes: [],
  primaryKeys: ["id"],
  relationIds: [],
  relationCounts: [],
  relations: [],
  schemas: [],
  scopeKeys: [],
  uniques: [],
  versionKeys: [],
});

const createOptions = (
  overrides?: Partial<ProteusRedisOptions>,
): ProteusRedisOptions => ({
  driver: "redis",
  host: "localhost",
  port: 6379,
  logger: createMockLogger(),
  ...overrides,
});

const createDriver = (
  overrides?: Partial<ProteusRedisOptions>,
  resolveMetadata?: MetadataResolver,
): { driver: RedisDriver; logger: ILogger } => {
  const logger = createMockLogger();
  const options = createOptions({ ...overrides, logger });
  const resolver = resolveMetadata ?? (() => createBaseMetadata());

  const driver = new RedisDriver(options, logger, null, resolver);
  return { driver, logger };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe("RedisDriver", () => {
  // ─── connect ────────────────────────────────────────────────────────

  describe("connect", () => {
    test("creates ioredis client and calls connect", async () => {
      const { driver } = createDriver();
      await driver.connect();

      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    test("is idempotent when already connected", async () => {
      const { driver } = createDriver();
      await driver.connect();
      await driver.connect();

      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    test("connects with URL when provided", async () => {
      const logger = createMockLogger();
      const options: ProteusRedisOptions = {
        driver: "redis",
        url: "redis://localhost:6379/0",
        logger,
      };
      const resolver = () => createBaseMetadata();
      const driver = new RedisDriver(options, logger, null, resolver);
      await driver.connect();

      const Redis = (await import("ioredis")).default;
      expect(Redis).toHaveBeenCalledWith(
        "redis://localhost:6379/0",
        expect.objectContaining({ lazyConnect: true }),
      );
    });

    test("connects with individual options when no URL", async () => {
      const { driver } = createDriver({
        host: "redis.example.com",
        port: 6380,
        user: "admin",
        password: "secret",
        db: 3,
        maxRetriesPerRequest: 5,
      });
      await driver.connect();

      const Redis = (await import("ioredis")).default;
      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: "redis.example.com",
          port: 6380,
          username: "admin",
          password: "secret",
          db: 3,
          maxRetriesPerRequest: 5,
          lazyConnect: true,
        }),
      );
    });
  });

  // ─── disconnect ─────────────────────────────────────────────────────

  describe("disconnect", () => {
    test("calls quit on the client", async () => {
      const { driver } = createDriver();
      await driver.connect();
      await driver.disconnect();

      expect(mockQuit).toHaveBeenCalledTimes(1);
    });

    test("is idempotent when already disconnected", async () => {
      const { driver } = createDriver();
      await driver.disconnect();

      expect(mockQuit).not.toHaveBeenCalled();
    });

    test("can reconnect after disconnect", async () => {
      const { driver } = createDriver();
      await driver.connect();
      await driver.disconnect();
      await driver.connect();

      expect(mockConnect).toHaveBeenCalledTimes(2);
    });
  });

  // ─── ping ───────────────────────────────────────────────────────────

  describe("ping", () => {
    test("returns true on PONG", async () => {
      const { driver } = createDriver();
      await driver.connect();

      const result = await driver.ping();
      expect(result).toBe(true);
    });

    test("returns false on non-PONG response", async () => {
      mockPing.mockResolvedValueOnce("ERROR");
      const { driver } = createDriver();
      await driver.connect();

      const result = await driver.ping();
      expect(result).toBe(false);
    });

    test("throws when not connected", async () => {
      const { driver } = createDriver();
      await expect(driver.ping()).rejects.toThrow(RedisDriverError);
    });
  });

  // ─── setup ──────────────────────────────────────────────────────────

  describe("setup", () => {
    test("validates each entity", async () => {
      const { driver } = createDriver();
      class Entity1 {}
      class Entity2 {}

      await expect(
        driver.setup([Entity1 as any, Entity2 as any]),
      ).resolves.toBeUndefined();
    });

    test("throws for entity with unsupported features", async () => {
      const resolver: MetadataResolver = () => ({
        ...createBaseMetadata(),
        uniques: [{ keys: ["email"], name: null }],
      });

      const { driver } = createDriver(undefined, resolver);
      await expect(driver.setup([class {} as any])).rejects.toThrow(NotSupportedError);
    });
  });

  // ─── createExecutor ─────────────────────────────────────────────────

  describe("createExecutor", () => {
    test("returns a RedisExecutor", async () => {
      const { driver } = createDriver();
      await driver.connect();

      const executor = driver.createExecutor(class {} as any);
      expect(executor).toBeDefined();
    });

    test("throws when not connected", () => {
      const { driver } = createDriver();
      expect(() => driver.createExecutor(class {} as any)).toThrow(RedisDriverError);
    });
  });

  // ─── createTransactionalExecutor ────────────────────────────────────

  describe("createTransactionalExecutor", () => {
    test("returns the same executor (no TX isolation)", async () => {
      const { driver } = createDriver();
      await driver.connect();

      const handle = await driver.beginTransaction();
      const executor = driver.createTransactionalExecutor(class {} as any, handle);
      expect(executor).toBeDefined();
    });
  });

  // ─── createRepository ───────────────────────────────────────────────

  describe("createRepository", () => {
    test("throws when entity metadata is not registered", async () => {
      const { driver } = createDriver();
      await driver.connect();

      // Undecorated class has no metadata, so repository creation fails
      expect(() => driver.createRepository(class {} as any)).toThrow(
        "Entity metadata not found",
      );
    });
  });

  // ─── createQueryBuilder ─────────────────────────────────────────────

  describe("createQueryBuilder", () => {
    test("returns a RedisQueryBuilder", async () => {
      const { driver } = createDriver();
      await driver.connect();

      const qb = driver.createQueryBuilder(class {} as any);
      expect(qb).toBeDefined();
      expect(qb.where).toBeDefined();
      expect(qb.getMany).toBeDefined();
    });

    test("throws when not connected", () => {
      const { driver } = createDriver();
      expect(() => driver.createQueryBuilder(class {} as any)).toThrow(RedisDriverError);
    });
  });

  // ─── acquireClient ──────────────────────────────────────────────────

  describe("acquireClient", () => {
    test("returns the ioredis client", async () => {
      const { driver } = createDriver();
      await driver.connect();

      const client = await driver.acquireClient();
      expect(client).toBeDefined();
      expect(client.ping).toBeDefined();
    });

    test("throws when not connected", async () => {
      const { driver } = createDriver();
      await expect(driver.acquireClient()).rejects.toThrow(RedisDriverError);
    });
  });

  // ─── beginTransaction ───────────────────────────────────────────────

  describe("beginTransaction", () => {
    test("returns a handle with active state", async () => {
      const { driver } = createDriver();
      const handle = await driver.beginTransaction();
      expect(handle).toMatchSnapshot();
    });
  });

  // ─── commitTransaction ──────────────────────────────────────────────

  describe("commitTransaction", () => {
    test("sets handle state to committed", async () => {
      const { driver } = createDriver();
      const handle = await driver.beginTransaction();
      await driver.commitTransaction(handle);
      expect(handle).toMatchSnapshot();
    });

    test("throws when already committed", async () => {
      const { driver } = createDriver();
      const handle = await driver.beginTransaction();
      await driver.commitTransaction(handle);

      await expect(driver.commitTransaction(handle)).rejects.toThrow(RedisDriverError);
      await expect(driver.commitTransaction(handle)).rejects.toThrow("Cannot commit");
    });

    test("throws when already rolled back", async () => {
      const { driver } = createDriver();
      const handle = await driver.beginTransaction();
      await driver.rollbackTransaction(handle);

      await expect(driver.commitTransaction(handle)).rejects.toThrow(RedisDriverError);
    });
  });

  // ─── rollbackTransaction ────────────────────────────────────────────

  describe("rollbackTransaction", () => {
    test("sets handle state to rolledBack", async () => {
      const { driver } = createDriver();
      const handle = await driver.beginTransaction();
      await driver.rollbackTransaction(handle);
      expect(handle).toMatchSnapshot();
    });

    test("throws when already committed", async () => {
      const { driver } = createDriver();
      const handle = await driver.beginTransaction();
      await driver.commitTransaction(handle);

      await expect(driver.rollbackTransaction(handle)).rejects.toThrow(RedisDriverError);
      await expect(driver.rollbackTransaction(handle)).rejects.toThrow("Cannot rollback");
    });

    test("throws when already rolled back", async () => {
      const { driver } = createDriver();
      const handle = await driver.beginTransaction();
      await driver.rollbackTransaction(handle);

      await expect(driver.rollbackTransaction(handle)).rejects.toThrow(RedisDriverError);
    });
  });

  // ─── withTransaction ────────────────────────────────────────────────

  describe("withTransaction", () => {
    test("commits on successful callback", async () => {
      const { driver } = createDriver();
      const result = await driver.withTransaction(async () => "ok");
      expect(result).toBe("ok");
    });

    test("rolls back on error", async () => {
      const { driver } = createDriver();

      // T-007: Spy on rollbackTransaction to verify it's actually called on failure
      const rollbackSpy = jest.spyOn(driver, "rollbackTransaction");

      await expect(
        driver.withTransaction(async () => {
          throw new Error("test error");
        }),
      ).rejects.toThrow("test error");

      expect(rollbackSpy).toHaveBeenCalledTimes(1);
    });

    test("provides a transaction context", async () => {
      const { driver } = createDriver();
      await driver.withTransaction(async (ctx) => {
        expect(ctx).toBeDefined();
        expect(ctx.commit).toBeDefined();
        expect(ctx.rollback).toBeDefined();
      });
    });
  });

  // ─── cloneWithGetters ───────────────────────────────────────────────

  describe("cloneWithGetters", () => {
    test("returns a new driver instance", async () => {
      const { driver } = createDriver();
      const cloned = driver.cloneWithGetters(
        () => new Map(),
        async () => {},
      );

      expect(cloned).toBeInstanceOf(RedisDriver);
      expect(cloned).not.toBe(driver);
    });

    test("shares the same ioredis client", async () => {
      const { driver } = createDriver();
      await driver.connect();

      const cloned = driver.cloneWithGetters(
        () => new Map(),
        async () => {},
      );

      const originalClient = await driver.acquireClient();
      const clonedClient = await cloned.acquireClient();
      expect(clonedClient).toBe(originalClient);
    });

    test("uses the provided filter registry getter", async () => {
      const { driver } = createDriver();
      await driver.connect();

      const customRegistry = new Map();
      customRegistry.set("test", { enabled: true, params: {} });

      const cloned = driver.cloneWithGetters(
        () => customRegistry,
        async () => {},
      );

      // The cloned driver should use the new registry getter
      // (indirectly tested through createExecutor)
      const executor = cloned.createExecutor(class {} as any);
      expect(executor).toBeDefined();
    });
  });
});
