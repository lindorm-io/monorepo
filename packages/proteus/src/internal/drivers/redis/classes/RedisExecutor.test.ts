import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type Mock,
  type MockedFunction,
} from "vitest";
import type { Dict } from "@lindorm/types";
import type {
  EntityMetadata,
  MetaField,
  MetaFilter,
} from "../../../entity/types/metadata";
import { RedisExecutor } from "./RedisExecutor";
import { RedisDuplicateKeyError } from "../errors/RedisDuplicateKeyError";
import { RedisOptimisticLockError } from "../errors/RedisOptimisticLockError";
import { RedisDriverError } from "../errors/RedisDriverError";

// ─── Module Mocks ────────────────────────────────────────────────────────────

vi.mock("../utils/build-entity-key", () => ({
  buildEntityKey: vi.fn((_target, pkValues, namespace) => {
    const parts = namespace
      ? [namespace, "entity", "test_entity"]
      : ["entity", "test_entity"];
    return [...parts, ...pkValues].join(":");
  }),
  buildEntityKeyFromRow: vi.fn((_target, row, metadata, namespace) => {
    const parts = namespace
      ? [namespace, "entity", "test_entity"]
      : ["entity", "test_entity"];
    const pkValues = metadata.primaryKeys.map((pk: string) => row[pk]);
    return [...parts, ...pkValues].join(":");
  }),
}));

vi.mock("../utils/build-scan-pattern", () => ({
  buildScanPattern: vi.fn((_target, namespace) =>
    namespace ? `${namespace}:entity:test_entity:*` : "entity:test_entity:*",
  ),
}));

vi.mock("../utils/dehydrate-entity", () => ({
  dehydrateToRow: vi.fn((entity: Record<string, unknown>, _metadata: EntityMetadata) => ({
    ...entity,
  })),
}));

vi.mock("../utils/serialize-hash", () => ({
  serializeHash: vi.fn((row: Dict, _fields: unknown, _relations: unknown) => {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v == null) continue;
      if (v instanceof Date) {
        result[k] = v.toISOString();
      } else {
        result[k] = String(v);
      }
    }
    return result;
  }),
}));

vi.mock("../utils/deserialize-hash", () => ({
  deserializeHash: vi.fn(
    (hash: Record<string, string>, fields: Array<MetaField>, _relations: unknown) => {
      if (Object.keys(hash).length === 0) return null;
      const result: Dict = {};
      for (const field of fields) {
        if (field.computed) continue;
        const raw = hash[field.key];
        if (raw === undefined) {
          result[field.key] = null;
        } else if (field.type === "integer") {
          result[field.key] = parseInt(raw, 10);
        } else if (field.type === "boolean") {
          result[field.key] = raw === "true";
        } else if (field.type === "date" || field.type === "timestamp") {
          result[field.key] = new Date(raw);
        } else {
          result[field.key] = raw;
        }
      }
      return result;
    },
  ),
}));

vi.mock("../utils/is-pk-exact", () => ({
  extractExactPk: vi.fn(
    (criteria: Record<string, unknown>, primaryKeys: Array<string>) => {
      const values: Array<unknown> = [];
      for (const pk of primaryKeys) {
        const value = criteria[pk];
        if (value === undefined || value === null || typeof value === "object")
          return null;
        values.push(value);
      }
      return values.length === primaryKeys.length ? values : null;
    },
  ),
}));

vi.mock("../utils/scan-entity-keys", () => ({
  scanEntityKeys: vi.fn(),
}));

vi.mock("../utils/redis-auto-increment", () => ({
  applyRedisAutoIncrement: vi.fn(),
}));

vi.mock("../../../entity/utils/default-hydrate-entity", () => ({
  defaultHydrateEntity: vi.fn((data: Dict, metadata: EntityMetadata) => {
    const entity = new metadata.target();
    for (const field of metadata.fields) {
      if (field.key in data) {
        (entity as any)[field.key] = data[field.key];
      }
    }
    return entity;
  }),
}));

vi.mock("../../../utils/repository/guard-empty-criteria", () => ({
  guardEmptyCriteria: vi.fn(
    (criteria: Record<string, unknown>, operation: string, ErrorClass: any) => {
      if (Object.keys(criteria).length === 0) {
        throw new ErrorClass(`${operation} requires non-empty criteria`);
      }
    },
  ),
}));

vi.mock("../../../utils/query/resolve-filters", () => ({
  resolveFilters: vi.fn(() => []),
}));

vi.mock("../../../utils/query/merge-system-filter-overrides", () => ({
  mergeSystemFilterOverrides: vi.fn(
    (overrides: unknown, _withDeleted: boolean, _withoutScope: boolean) => overrides,
  ),
}));

vi.mock("../../../entity/metadata/auto-filters", () => ({
  generateAutoFilters: vi.fn(() => []),
}));

// ─── Imports of mocked modules ──────────────────────────────────────────────

import { scanEntityKeys } from "../utils/scan-entity-keys";
import { applyRedisAutoIncrement } from "../utils/redis-auto-increment";
import { resolveFilters } from "../../../utils/query/resolve-filters";

const mockedScanEntityKeys = scanEntityKeys as MockedFunction<typeof scanEntityKeys>;
const mockedApplyRedisAutoIncrement = applyRedisAutoIncrement as MockedFunction<
  typeof applyRedisAutoIncrement
>;
const mockedResolveFilters = resolveFilters as MockedFunction<typeof resolveFilters>;

// ─── Test Entities ──────────────────────────────────────────────────────────

class TestEntity {
  id!: string;
  name!: string;
  version!: number;
  createdAt!: Date;
  updatedAt!: Date;
  score!: number;
}

class SimpleEntity {
  id!: string;
  label!: string;
}

class ExpiryEntity {
  id!: string;
  name!: string;
  expiresAt!: Date | null;
}

class SoftDeleteEntity {
  id!: string;
  name!: string;
  deletedAt!: Date | null;
}

// ─── Metadata Factories ────────────────────────────────────────────────────

const makeField = (
  key: string,
  type: string,
  decorator: string = "Field",
  opts: Partial<MetaField> = {},
): MetaField =>
  ({
    key,
    type,
    decorator,
    computed: false,
    embedded: null,
    encrypted: null,
    nullable: false,
    readonly: false,
    order: null,
    transform: null,
    ...opts,
  }) as MetaField;

const baseFields: Array<MetaField> = [
  makeField("id", "uuid", "PrimaryKey"),
  makeField("name", "string"),
  makeField("version", "integer", "Version"),
  makeField("createdAt", "timestamp", "CreateDate"),
  makeField("updatedAt", "timestamp", "UpdateDate"),
  makeField("score", "integer"),
];

const baseMetadata: EntityMetadata = {
  target: TestEntity,
  cache: null,
  checks: [],
  defaultOrder: null,
  embeddedLists: [],
  entity: { name: "test_entity", namespace: null } as any,
  extras: [],
  fields: baseFields,
  filters: [],
  generated: [],
  hooks: [],
  indexes: [],
  primaryKeys: ["id"],
  relationIds: [],
  relationCounts: [],
  relations: [],
  schemas: [],
  scopeKeys: [],
  uniques: [],
  versionKeys: [],
} as unknown as EntityMetadata;

const simpleMetadata: EntityMetadata = {
  ...baseMetadata,
  target: SimpleEntity,
  fields: [makeField("id", "uuid", "PrimaryKey"), makeField("label", "string")],
  // no version field
} as unknown as EntityMetadata;

const expiryMetadata: EntityMetadata = {
  ...baseMetadata,
  target: ExpiryEntity,
  fields: [
    makeField("id", "uuid", "PrimaryKey"),
    makeField("name", "string"),
    makeField("expiresAt", "timestamp", "ExpiryDate", { nullable: true }),
  ],
} as unknown as EntityMetadata;

const softDeleteMetadata: EntityMetadata = {
  ...baseMetadata,
  target: SoftDeleteEntity,
  fields: [
    makeField("id", "uuid", "PrimaryKey"),
    makeField("name", "string"),
    makeField("deletedAt", "timestamp", "DeleteDate", { nullable: true }),
  ],
} as unknown as EntityMetadata;

// ─── Mock Redis Client Factory ──────────────────────────────────────────────

const createMockPipeline = () => {
  const commands: Array<{ cmd: string; args: Array<any> }> = [];
  let execResults: Array<[Error | null, any]> = [];

  const pipeline: any = {
    _commands: commands,
    _setExecResults: (results: Array<[Error | null, any]>) => {
      execResults = results;
    },
    del: vi.fn((...args: any[]) => {
      commands.push({ cmd: "del", args });
      return pipeline;
    }),
    hset: vi.fn((...args: any[]) => {
      commands.push({ cmd: "hset", args });
      return pipeline;
    }),
    hdel: vi.fn((...args: any[]) => {
      commands.push({ cmd: "hdel", args });
      return pipeline;
    }),
    hget: vi.fn((...args: any[]) => {
      commands.push({ cmd: "hget", args });
      return pipeline;
    }),
    hgetall: vi.fn((...args: any[]) => {
      commands.push({ cmd: "hgetall", args });
      return pipeline;
    }),
    exec: vi.fn(() =>
      Promise.resolve(
        execResults.length > 0 ? execResults : commands.map(() => [null, "OK"]),
      ),
    ),
  };

  return pipeline;
};

const createMockRedis = () => {
  const mockPipeline = createMockPipeline();

  return {
    client: {
      exists: vi.fn().mockResolvedValue(0),
      hset: vi.fn().mockResolvedValue(1),
      hgetall: vi.fn().mockResolvedValue({}),
      del: vi.fn().mockResolvedValue(1),
      hdel: vi.fn().mockResolvedValue(1),
      eval: vi.fn().mockResolvedValue(1),
      incr: vi.fn().mockResolvedValue(1),
      pttl: vi.fn().mockResolvedValue(-1),
      pexpireat: vi.fn().mockResolvedValue(1),
      persist: vi.fn().mockResolvedValue(1),
      scan: vi.fn(),
      pipeline: vi.fn(() => mockPipeline),
    } as any,
    mockPipeline,
  };
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("RedisExecutor", () => {
  let redis: ReturnType<typeof createMockRedis>;
  let executor: RedisExecutor<TestEntity>;

  beforeEach(() => {
    vi.clearAllMocks();
    redis = createMockRedis();
    executor = new RedisExecutor<TestEntity>(baseMetadata, redis.client, null);
    mockedScanEntityKeys.mockResolvedValue([]);
    mockedApplyRedisAutoIncrement.mockResolvedValue(undefined);
    mockedResolveFilters.mockReturnValue([]);
  });

  // ─── executeInsert ──────────────────────────────────────────────────

  describe("executeInsert", () => {
    test("should insert entity into Redis HASH", async () => {
      const entity = new TestEntity();
      entity.id = "abc-123";
      entity.name = "test";
      entity.version = 1;
      entity.score = 42;

      const result = await executor.executeInsert(entity as any);

      expect(redis.client.exists).toHaveBeenCalledTimes(1);
      expect(redis.client.hset).toHaveBeenCalledTimes(1);
      expect(result).toMatchSnapshot();
    });

    test("should call applyRedisAutoIncrement", async () => {
      const entity = new TestEntity();
      entity.id = "abc-123";
      entity.name = "test";

      await executor.executeInsert(entity as any);

      expect(mockedApplyRedisAutoIncrement).toHaveBeenCalledTimes(1);
    });

    test("should throw RedisDuplicateKeyError when key exists", async () => {
      redis.client.exists.mockResolvedValueOnce(1);

      const entity = new TestEntity();
      entity.id = "abc-123";
      entity.name = "test";

      await expect(executor.executeInsert(entity as any)).rejects.toThrow(
        RedisDuplicateKeyError,
      );
    });

    test("should apply PEXPIREAT for entity with expiry", async () => {
      const expiryExecutor = new RedisExecutor<ExpiryEntity>(
        expiryMetadata,
        redis.client,
        null,
      );

      const entity = new ExpiryEntity();
      entity.id = "exp-123";
      entity.name = "expiry-test";
      entity.expiresAt = new Date("2025-06-01T00:00:00.000Z");

      await expiryExecutor.executeInsert(entity as any);

      expect(redis.client.pexpireat).toHaveBeenCalledWith(
        expect.any(String),
        new Date("2025-06-01T00:00:00.000Z").getTime(),
      );
    });

    test("should persist key when expiry is null", async () => {
      const expiryExecutor = new RedisExecutor<ExpiryEntity>(
        expiryMetadata,
        redis.client,
        null,
      );

      const entity = new ExpiryEntity();
      entity.id = "exp-456";
      entity.name = "no-expiry";
      entity.expiresAt = null;

      await expiryExecutor.executeInsert(entity as any);

      expect(redis.client.persist).toHaveBeenCalledTimes(1);
    });

    test("should use namespace in key when provided", async () => {
      const nsExecutor = new RedisExecutor<TestEntity>(
        baseMetadata,
        redis.client,
        "myapp",
      );

      const entity = new TestEntity();
      entity.id = "ns-123";
      entity.name = "namespaced";

      await nsExecutor.executeInsert(entity as any);

      // T-012: Assert exact key format rather than loose stringContaining
      // buildEntityKey mock: [namespace, "entity", "test_entity", ...pkValues].join(":")
      expect(redis.client.exists).toHaveBeenCalledWith("myapp:entity:test_entity:ns-123");
    });
  });

  // ─── executeUpdate ──────────────────────────────────────────────────

  describe("executeUpdate", () => {
    test("should perform versioned update via Lua script", async () => {
      redis.client.eval.mockResolvedValueOnce(1);

      const entity = new TestEntity();
      entity.id = "abc-123";
      entity.name = "updated";
      entity.version = 2;

      const result = await executor.executeUpdate(entity as any);

      expect(redis.client.eval).toHaveBeenCalledTimes(1);
      expect(result).toMatchSnapshot();
    });

    test("should throw RedisDriverError when versioned update finds no key", async () => {
      redis.client.eval.mockResolvedValueOnce(-1);

      const entity = new TestEntity();
      entity.id = "nonexistent";
      entity.version = 2;

      await expect(executor.executeUpdate(entity as any)).rejects.toThrow(
        RedisDriverError,
      );
    });

    test("should throw RedisOptimisticLockError on version mismatch", async () => {
      redis.client.eval.mockResolvedValueOnce(0);

      const entity = new TestEntity();
      entity.id = "abc-123";
      entity.version = 5;

      await expect(executor.executeUpdate(entity as any)).rejects.toThrow(
        RedisOptimisticLockError,
      );
    });

    test("should perform unversioned update via GUARDED_HSET Lua script", async () => {
      const simpleExecutor = new RedisExecutor<SimpleEntity>(
        simpleMetadata,
        redis.client,
        null,
      );

      const entity = new SimpleEntity();
      entity.id = "simple-1";
      entity.label = "updated-label";

      const result = await simpleExecutor.executeUpdate(entity as any);

      // Unversioned update now uses GUARDED_HSET Lua script (EXISTS check + HSET)
      expect(redis.client.eval).toHaveBeenCalledTimes(1);
      expect(redis.client.hset).not.toHaveBeenCalled();
      expect(result).toMatchSnapshot();
    });

    test("should throw RedisDriverError when version field contains non-numeric data", async () => {
      // T-015: Lua script returns -2 when the version field in the hash is non-numeric
      // (e.g., key exists but version was corrupted — cannot compare atomically)
      redis.client.eval.mockResolvedValueOnce(-2);

      const entity = new TestEntity();
      entity.id = "corrupted";
      entity.version = 1;

      await expect(executor.executeUpdate(entity as any)).rejects.toThrow(
        "Version field contains non-numeric data",
      );
    });

    test("should apply PEXPIREAT after versioned update", async () => {
      const expiryVersionedMetadata = {
        ...expiryMetadata,
        fields: [...expiryMetadata.fields, makeField("version", "integer", "Version")],
      } as unknown as EntityMetadata;

      const expiryExecutor = new RedisExecutor<any>(
        expiryVersionedMetadata,
        redis.client,
        null,
      );

      redis.client.eval.mockResolvedValueOnce(1);

      const entity = {
        id: "exp-1",
        name: "test",
        expiresAt: new Date("2025-12-01"),
        version: 2,
      };

      await expiryExecutor.executeUpdate(entity as any);

      expect(redis.client.pexpireat).toHaveBeenCalledTimes(1);
    });
  });

  // ─── executeDelete ──────────────────────────────────────────────────

  describe("executeDelete", () => {
    test("should delete by PK-exact using direct DEL", async () => {
      redis.mockPipeline._setExecResults([[null, 1]]);

      await executor.executeDelete({ id: "abc-123" } as any);

      expect(redis.mockPipeline.del).toHaveBeenCalledTimes(1);
    });

    test("should delete via SCAN + filter for non-PK criteria", async () => {
      mockedScanEntityKeys.mockResolvedValueOnce([
        "entity:test_entity:1",
        "entity:test_entity:2",
      ]);
      redis.mockPipeline._setExecResults([
        [
          null,
          {
            id: "1",
            name: "match",
            version: "1",
            score: "10",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
        [
          null,
          {
            id: "2",
            name: "no-match",
            version: "1",
            score: "20",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
      ]);

      // T-016: Provide separate pipeline for DEL phase so we can assert on exact keys
      const delPipeline = createMockPipeline();
      delPipeline._setExecResults([[null, 1]]);
      redis.client.pipeline
        .mockReturnValueOnce(redis.mockPipeline)
        .mockReturnValueOnce(delPipeline);

      await executor.executeDelete({ name: "match" } as any);

      expect(mockedScanEntityKeys).toHaveBeenCalledTimes(1);
      // Only the matching entity's key should be deleted
      expect(delPipeline.del).toHaveBeenCalledWith("entity:test_entity:1");
      expect(delPipeline.del).not.toHaveBeenCalledWith("entity:test_entity:2");
    });

    test("should throw on empty criteria", async () => {
      await expect(executor.executeDelete({} as any)).rejects.toThrow(RedisDriverError);
    });

    test("should respect delete limit", async () => {
      mockedScanEntityKeys.mockResolvedValueOnce([
        "entity:test_entity:1",
        "entity:test_entity:2",
        "entity:test_entity:3",
      ]);
      redis.mockPipeline._setExecResults([
        [
          null,
          {
            id: "1",
            name: "a",
            version: "1",
            score: "10",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
        [
          null,
          {
            id: "2",
            name: "a",
            version: "1",
            score: "20",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
        [
          null,
          {
            id: "3",
            name: "a",
            version: "1",
            score: "30",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
      ]);

      // Provide a separate pipeline for the DEL phase so we can assert on it independently
      const delPipeline = createMockPipeline();
      delPipeline._setExecResults([
        [null, 1],
        [null, 1],
      ]);
      redis.client.pipeline
        .mockReturnValueOnce(redis.mockPipeline)
        .mockReturnValueOnce(delPipeline);

      await executor.executeDelete({ name: "a" } as any, { limit: 2 });

      // T-002: Limit of 2 means exactly 2 DEL calls (not 3 even though 3 rows matched)
      expect(delPipeline.del).toHaveBeenCalledTimes(2);
    });
  });

  // ─── executeSoftDelete ──────────────────────────────────────────────

  describe("executeSoftDelete", () => {
    test("should set deletedAt via pipeline HSET", async () => {
      const sdExecutor = new RedisExecutor<SoftDeleteEntity>(
        softDeleteMetadata,
        redis.client,
        null,
      );

      mockedScanEntityKeys.mockResolvedValueOnce(["entity:test_entity:1"]);
      redis.mockPipeline._setExecResults([
        [null, { id: "1", name: "test", deletedAt: "" }],
      ]);

      await sdExecutor.executeSoftDelete({ id: "1" } as any);

      // T-001: Verify HSET was called with the delete field name and an ISO timestamp string
      expect(redis.client.pipeline).toHaveBeenCalled();
      expect(redis.mockPipeline.hset).toHaveBeenCalledWith(
        expect.any(String),
        "deletedAt",
        expect.any(String),
      );
      // The value should be a valid ISO timestamp
      const hsetCall = redis.mockPipeline.hset.mock.calls.find(
        (c: any[]) => c[1] === "deletedAt",
      );
      expect(hsetCall).toBeDefined();
      expect(() => new Date(hsetCall![2])).not.toThrow();
    });

    test("should throw on empty criteria", async () => {
      const sdExecutor = new RedisExecutor<SoftDeleteEntity>(
        softDeleteMetadata,
        redis.client,
        null,
      );

      await expect(sdExecutor.executeSoftDelete({} as any)).rejects.toThrow(
        RedisDriverError,
      );
    });
  });

  // ─── executeRestore ─────────────────────────────────────────────────

  describe("executeRestore", () => {
    test("should remove deletedAt via pipeline HDEL", async () => {
      const sdExecutor = new RedisExecutor<SoftDeleteEntity>(
        softDeleteMetadata,
        redis.client,
        null,
      );

      mockedScanEntityKeys.mockResolvedValueOnce(["entity:test_entity:1"]);
      redis.mockPipeline._setExecResults([
        [null, { id: "1", name: "test", deletedAt: "2025-01-01T00:00:00.000Z" }],
      ]);

      await sdExecutor.executeRestore({ id: "1" } as any);

      // T-003: Verify hdel was called with the correct delete field name
      expect(redis.client.pipeline).toHaveBeenCalled();
      expect(redis.mockPipeline.hdel).toHaveBeenCalledWith(
        expect.any(String),
        "deletedAt",
      );
    });

    test("should throw on empty criteria", async () => {
      const sdExecutor = new RedisExecutor<SoftDeleteEntity>(
        softDeleteMetadata,
        redis.client,
        null,
      );

      await expect(sdExecutor.executeRestore({} as any)).rejects.toThrow(
        RedisDriverError,
      );
    });
  });

  // ─── executeDeleteExpired ───────────────────────────────────────────

  describe("executeDeleteExpired", () => {
    test("should delete keys with expired expiresAt", async () => {
      const expiryExecutor = new RedisExecutor<ExpiryEntity>(
        expiryMetadata,
        redis.client,
        null,
      );

      mockedScanEntityKeys.mockResolvedValueOnce([
        "entity:test_entity:1",
        "entity:test_entity:2",
      ]);

      const pastDate = new Date(Date.now() - 10000).toISOString();
      const futureDate = new Date(Date.now() + 100000).toISOString();

      redis.mockPipeline._setExecResults([
        [null, pastDate],
        [null, futureDate],
      ]);

      // Need a second pipeline for the DEL
      const delPipeline = createMockPipeline();
      delPipeline._setExecResults([[null, 1]]);
      redis.client.pipeline
        .mockReturnValueOnce(redis.mockPipeline)
        .mockReturnValueOnce(delPipeline);

      await expiryExecutor.executeDeleteExpired();

      expect(delPipeline.del).toHaveBeenCalledWith("entity:test_entity:1");
      expect(delPipeline.del).not.toHaveBeenCalledWith("entity:test_entity:2");
    });

    test("should be no-op when entity has no expiry field", async () => {
      await executor.executeDeleteExpired();

      expect(mockedScanEntityKeys).not.toHaveBeenCalled();
    });

    test("should be no-op when no keys found", async () => {
      const expiryExecutor = new RedisExecutor<ExpiryEntity>(
        expiryMetadata,
        redis.client,
        null,
      );

      mockedScanEntityKeys.mockResolvedValueOnce([]);

      await expiryExecutor.executeDeleteExpired();

      expect(redis.client.pipeline).not.toHaveBeenCalled();
    });
  });

  // ─── executeTtl ─────────────────────────────────────────────────────

  describe("executeTtl", () => {
    test("should return null when entity has no expiry field", async () => {
      const result = await executor.executeTtl({ id: "abc-123" } as any);

      expect(result).toBeNull();
    });

    test("should return null when TTL is -1 (no expiry)", async () => {
      const expiryExecutor = new RedisExecutor<ExpiryEntity>(
        expiryMetadata,
        redis.client,
        null,
      );

      redis.client.pttl.mockResolvedValueOnce(-1);

      const result = await expiryExecutor.executeTtl({ id: "exp-1" } as any);

      expect(result).toBeNull();
    });

    test("should return TTL in milliseconds when positive", async () => {
      const expiryExecutor = new RedisExecutor<ExpiryEntity>(
        expiryMetadata,
        redis.client,
        null,
      );

      redis.client.pttl.mockResolvedValueOnce(3600);

      const result = await expiryExecutor.executeTtl({ id: "exp-1" } as any);

      expect(result).toBe(3600);
    });

    test("should throw when TTL is -2 (key not found)", async () => {
      const expiryExecutor = new RedisExecutor<ExpiryEntity>(
        expiryMetadata,
        redis.client,
        null,
      );

      redis.client.pttl.mockResolvedValueOnce(-2);

      await expect(
        expiryExecutor.executeTtl({ id: "nonexistent" } as any),
      ).rejects.toThrow(RedisDriverError);
    });

    test("should throw when criteria is not PK-exact", async () => {
      const expiryExecutor = new RedisExecutor<ExpiryEntity>(
        expiryMetadata,
        redis.client,
        null,
      );

      await expect(expiryExecutor.executeTtl({ name: "not-pk" } as any)).rejects.toThrow(
        RedisDriverError,
      );
    });
  });

  // ─── executeFind ────────────────────────────────────────────────────

  describe("executeFind", () => {
    test("should use PK-exact HGETALL for direct lookup", async () => {
      redis.client.hgetall.mockResolvedValueOnce({
        id: "abc-123",
        name: "found",
        version: "1",
        score: "10",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      });

      const results = await executor.executeFind({ id: "abc-123" } as any, {});

      expect(redis.client.hgetall).toHaveBeenCalledTimes(1);
      expect(mockedScanEntityKeys).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results).toMatchSnapshot();
    });

    test("should return empty array for non-existent PK", async () => {
      redis.client.hgetall.mockResolvedValueOnce({});

      const results = await executor.executeFind({ id: "nonexistent" } as any, {});

      expect(results).toHaveLength(0);
    });

    test("should use SCAN + filter for non-PK criteria", async () => {
      mockedScanEntityKeys.mockResolvedValueOnce([
        "entity:test_entity:1",
        "entity:test_entity:2",
      ]);
      redis.mockPipeline._setExecResults([
        [
          null,
          {
            id: "1",
            name: "match",
            version: "1",
            score: "10",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
        [
          null,
          {
            id: "2",
            name: "other",
            version: "1",
            score: "20",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
      ]);

      const results = await executor.executeFind({ name: "match" } as any, {});

      expect(mockedScanEntityKeys).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(1);
    });

    test("should apply ordering", async () => {
      mockedScanEntityKeys.mockResolvedValueOnce([
        "entity:test_entity:1",
        "entity:test_entity:2",
        "entity:test_entity:3",
      ]);
      redis.mockPipeline._setExecResults([
        [
          null,
          {
            id: "1",
            name: "c",
            version: "1",
            score: "30",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
        [
          null,
          {
            id: "2",
            name: "a",
            version: "1",
            score: "10",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
        [
          null,
          {
            id: "3",
            name: "b",
            version: "1",
            score: "20",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
      ]);

      const results = await executor.executeFind({} as any, {
        order: { name: "ASC" } as any,
      });

      const names = results.map((r) => r.name);
      expect(names).toMatchSnapshot();
    });

    test("should apply pagination with offset and limit", async () => {
      mockedScanEntityKeys.mockResolvedValueOnce([
        "entity:test_entity:1",
        "entity:test_entity:2",
        "entity:test_entity:3",
      ]);
      redis.mockPipeline._setExecResults([
        [
          null,
          {
            id: "1",
            name: "a",
            version: "1",
            score: "10",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
        [
          null,
          {
            id: "2",
            name: "b",
            version: "1",
            score: "20",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
        [
          null,
          {
            id: "3",
            name: "c",
            version: "1",
            score: "30",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
      ]);

      const results = await executor.executeFind({} as any, { offset: 1, limit: 1 });

      expect(results).toHaveLength(1);
      expect(results).toMatchSnapshot();
    });

    test("should apply offset/limit pagination", async () => {
      mockedScanEntityKeys.mockResolvedValueOnce([
        "entity:test_entity:1",
        "entity:test_entity:2",
        "entity:test_entity:3",
      ]);
      redis.mockPipeline._setExecResults([
        [
          null,
          {
            id: "1",
            name: "a",
            version: "1",
            score: "10",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
        [
          null,
          {
            id: "2",
            name: "b",
            version: "1",
            score: "20",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
        [
          null,
          {
            id: "3",
            name: "c",
            version: "1",
            score: "30",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
      ]);

      const results = await executor.executeFind({} as any, { offset: 1, limit: 1 });

      expect(results).toHaveLength(1);
      expect(results).toMatchSnapshot();
    });

    test("should apply select to narrow returned fields", async () => {
      redis.client.hgetall.mockResolvedValueOnce({
        id: "abc-123",
        name: "found",
        version: "1",
        score: "10",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      });

      const results = await executor.executeFind({ id: "abc-123" } as any, {
        select: ["id", "name"] as any,
      });

      expect(results).toHaveLength(1);
      expect(results).toMatchSnapshot();
    });

    test("should use defaultOrder when no explicit order given", async () => {
      const orderedMetadata = {
        ...baseMetadata,
        defaultOrder: { name: "DESC" },
      } as unknown as EntityMetadata;

      const orderedExecutor = new RedisExecutor<TestEntity>(
        orderedMetadata,
        redis.client,
        null,
      );

      mockedScanEntityKeys.mockResolvedValueOnce([
        "entity:test_entity:1",
        "entity:test_entity:2",
      ]);
      redis.mockPipeline._setExecResults([
        [
          null,
          {
            id: "1",
            name: "alpha",
            version: "1",
            score: "10",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
        [
          null,
          {
            id: "2",
            name: "beta",
            version: "1",
            score: "20",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
      ]);

      const results = await orderedExecutor.executeFind({} as any, {});

      const names = results.map((r) => r.name);
      expect(names).toMatchSnapshot();
    });

    test("should return empty array when SCAN yields no keys", async () => {
      mockedScanEntityKeys.mockResolvedValueOnce([]);

      const results = await executor.executeFind({} as any, {});

      expect(results).toHaveLength(0);
    });
  });

  // ─── executeCount ───────────────────────────────────────────────────

  describe("executeCount", () => {
    test("should return count of matching rows", async () => {
      mockedScanEntityKeys.mockResolvedValueOnce([
        "entity:test_entity:1",
        "entity:test_entity:2",
        "entity:test_entity:3",
      ]);
      redis.mockPipeline._setExecResults([
        [
          null,
          {
            id: "1",
            name: "a",
            version: "1",
            score: "10",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
        [
          null,
          {
            id: "2",
            name: "a",
            version: "1",
            score: "20",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
        [
          null,
          {
            id: "3",
            name: "b",
            version: "1",
            score: "30",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
      ]);

      const count = await executor.executeCount({ name: "a" } as any, {});

      expect(count).toBe(2);
    });

    test("should return 0 when no matching rows", async () => {
      mockedScanEntityKeys.mockResolvedValueOnce([]);

      const count = await executor.executeCount({ name: "nonexistent" } as any, {});

      expect(count).toBe(0);
    });
  });

  // ─── executeExists ──────────────────────────────────────────────────

  describe("executeExists", () => {
    test("should use HGETALL for PK-exact lookup — key found", async () => {
      redis.client.hgetall.mockResolvedValueOnce({
        id: "abc-123",
        name: "test",
        version: "1",
        score: "10",
        createdAt: "2025-01-01",
        updatedAt: "2025-01-01",
      });

      const result = await executor.executeExists({ id: "abc-123" } as any);

      expect(result).toBe(true);
      expect(redis.client.hgetall).toHaveBeenCalledTimes(1);
      expect(mockedScanEntityKeys).not.toHaveBeenCalled();
    });

    test("should use HGETALL for PK-exact lookup — key not found", async () => {
      redis.client.hgetall.mockResolvedValueOnce({});

      const result = await executor.executeExists({ id: "nonexistent" } as any);

      expect(result).toBe(false);
    });

    test("should use SCAN path for non-PK criteria", async () => {
      mockedScanEntityKeys.mockResolvedValueOnce(["entity:test_entity:1"]);
      redis.mockPipeline._setExecResults([
        [
          null,
          {
            id: "1",
            name: "match",
            version: "1",
            score: "10",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
      ]);

      const result = await executor.executeExists({ name: "match" } as any);

      expect(result).toBe(true);
      expect(mockedScanEntityKeys).toHaveBeenCalledTimes(1);
    });

    test("should return false when SCAN finds no match", async () => {
      mockedScanEntityKeys.mockResolvedValueOnce(["entity:test_entity:1"]);
      redis.mockPipeline._setExecResults([
        [
          null,
          {
            id: "1",
            name: "other",
            version: "1",
            score: "10",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
      ]);

      const result = await executor.executeExists({ name: "nonexistent" } as any);

      expect(result).toBe(false);
    });
  });

  // ─── executeIncrement ───────────────────────────────────────────────

  describe("executeIncrement", () => {
    test("should use GUARDED_HINCRBY for integer fields", async () => {
      mockedScanEntityKeys.mockResolvedValueOnce(["entity:test_entity:1"]);
      redis.mockPipeline._setExecResults([
        [
          null,
          {
            id: "1",
            name: "test",
            version: "1",
            score: "10",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
      ]);
      redis.client.eval.mockResolvedValueOnce(15);

      await executor.executeIncrement({ id: "1" } as any, "score" as any, 5);

      expect(redis.client.eval).toHaveBeenCalledTimes(1);
      expect(redis.client.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        "entity:test_entity:1",
        "score",
        "5",
      );
    });

    test("should use GUARDED_HINCRBYFLOAT for float fields", async () => {
      const floatMetadata = {
        ...baseMetadata,
        fields: [
          ...baseMetadata.fields.filter((f) => f.key !== "score"),
          makeField("score", "float"),
        ],
      } as unknown as EntityMetadata;

      const floatExecutor = new RedisExecutor<TestEntity>(
        floatMetadata,
        redis.client,
        null,
      );

      mockedScanEntityKeys.mockResolvedValueOnce(["entity:test_entity:1"]);
      redis.mockPipeline._setExecResults([
        [
          null,
          {
            id: "1",
            name: "test",
            version: "1",
            score: "10.5",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
      ]);
      redis.client.eval.mockResolvedValueOnce("13");

      await floatExecutor.executeIncrement({ id: "1" } as any, "score" as any, 2.5);

      expect(redis.client.eval).toHaveBeenCalledTimes(1);
    });

    test("should throw when key not found (zombie prevention)", async () => {
      mockedScanEntityKeys.mockResolvedValueOnce(["entity:test_entity:1"]);
      redis.mockPipeline._setExecResults([
        [
          null,
          {
            id: "1",
            name: "test",
            version: "1",
            score: "10",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
      ]);
      // Lua script returns null (not -1) when key not found (F-002 sentinel change)
      redis.client.eval.mockResolvedValueOnce(null);

      await expect(
        executor.executeIncrement({ id: "1" } as any, "score" as any, 5),
      ).rejects.toThrow(RedisDriverError);
    });
  });

  // ─── executeDecrement ───────────────────────────────────────────────

  describe("executeDecrement", () => {
    test("should negate value and use GUARDED_HINCRBY", async () => {
      mockedScanEntityKeys.mockResolvedValueOnce(["entity:test_entity:1"]);
      redis.mockPipeline._setExecResults([
        [
          null,
          {
            id: "1",
            name: "test",
            version: "1",
            score: "10",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
      ]);
      redis.client.eval.mockResolvedValueOnce(5);

      await executor.executeDecrement({ id: "1" } as any, "score" as any, 5);

      expect(redis.client.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        "entity:test_entity:1",
        "score",
        "-5",
      );
    });

    test("should throw when key not found (zombie prevention)", async () => {
      mockedScanEntityKeys.mockResolvedValueOnce(["entity:test_entity:1"]);
      redis.mockPipeline._setExecResults([
        [
          null,
          {
            id: "1",
            name: "test",
            version: "1",
            score: "10",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
      ]);
      // Lua script returns null (not -1) when key not found (F-002 sentinel change)
      redis.client.eval.mockResolvedValueOnce(null);

      await expect(
        executor.executeDecrement({ id: "1" } as any, "score" as any, 5),
      ).rejects.toThrow(RedisDriverError);
    });
  });

  // ─── executeInsertBulk ──────────────────────────────────────────────

  describe("executeInsertBulk", () => {
    test("should insert multiple entities", async () => {
      const entities = [
        Object.assign(new TestEntity(), {
          id: "bulk-1",
          name: "first",
          version: 1,
          score: 10,
        }),
        Object.assign(new TestEntity(), {
          id: "bulk-2",
          name: "second",
          version: 1,
          score: 20,
        }),
      ];

      const results = await executor.executeInsertBulk(entities as any);

      expect(results).toHaveLength(2);
      expect(redis.client.exists).toHaveBeenCalledTimes(2);
      expect(redis.client.hset).toHaveBeenCalledTimes(2);
    });

    test("should return empty array for empty input", async () => {
      const results = await executor.executeInsertBulk([]);

      expect(results).toHaveLength(0);
      expect(redis.client.exists).not.toHaveBeenCalled();
    });

    test("should stop on first duplicate and throw", async () => {
      redis.client.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

      const entities = [
        Object.assign(new TestEntity(), { id: "bulk-1", name: "first" }),
        Object.assign(new TestEntity(), { id: "bulk-2", name: "second" }),
      ];

      await expect(executor.executeInsertBulk(entities as any)).rejects.toThrow(
        RedisDuplicateKeyError,
      );

      expect(redis.client.hset).toHaveBeenCalledTimes(1);
    });
  });

  // ─── executeUpdateMany ──────────────────────────────────────────────

  describe("executeUpdateMany", () => {
    test("should update matching rows via pipeline HSET", async () => {
      mockedScanEntityKeys.mockResolvedValueOnce([
        "entity:test_entity:1",
        "entity:test_entity:2",
      ]);
      redis.mockPipeline._setExecResults([
        [
          null,
          {
            id: "1",
            name: "match",
            version: "1",
            score: "10",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
        [
          null,
          {
            id: "2",
            name: "match",
            version: "1",
            score: "20",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
      ]);

      const count = await executor.executeUpdateMany(
        { name: "match" } as any,
        { score: 99 } as any,
      );

      expect(count).toBe(2);
    });

    test("should return 0 when no rows match", async () => {
      mockedScanEntityKeys.mockResolvedValueOnce([]);

      const count = await executor.executeUpdateMany(
        { name: "nonexistent" } as any,
        { score: 99 } as any,
      );

      expect(count).toBe(0);
    });

    test("should use HDEL for null update values", async () => {
      mockedScanEntityKeys.mockResolvedValueOnce(["entity:test_entity:1"]);
      redis.mockPipeline._setExecResults([
        [
          null,
          {
            id: "1",
            name: "match",
            version: "1",
            score: "10",
            createdAt: "2025-01-01",
            updatedAt: "2025-01-01",
          },
        ],
      ]);

      // Need a fresh pipeline for the update phase
      const updatePipeline = createMockPipeline();
      updatePipeline._setExecResults([[null, 1]]);
      redis.client.pipeline
        .mockReturnValueOnce(redis.mockPipeline)
        .mockReturnValueOnce(updatePipeline);

      await executor.executeUpdateMany({ name: "match" } as any, { score: null } as any);

      expect(updatePipeline.hdel).toHaveBeenCalledWith("entity:test_entity:1", "score");
    });
  });

  // ─── Pipeline error handling ────────────────────────────────────────

  describe("pipeline error handling", () => {
    test("should throw when pipeline exec returns null", async () => {
      redis.mockPipeline.exec.mockResolvedValueOnce(null);

      await expect(executor.executeDelete({ id: "abc-123" } as any)).rejects.toThrow(
        RedisDriverError,
      );
    });
  });

  // ─── Namespace handling ─────────────────────────────────────────────

  describe("namespace", () => {
    test("should include namespace in SCAN pattern", async () => {
      const nsExecutor = new RedisExecutor<TestEntity>(
        baseMetadata,
        redis.client,
        "myapp",
      );
      mockedScanEntityKeys.mockResolvedValueOnce([]);

      await nsExecutor.executeFind({} as any, {});

      expect(mockedScanEntityKeys).toHaveBeenCalledWith(
        redis.client,
        "myapp:entity:test_entity:*",
      );
    });
  });

  // ─── Filter registry ───────────────────────────────────────────────

  describe("filterRegistry", () => {
    test("should pass filterRegistry to resolveFilters in executeFind", async () => {
      const registry = new Map([
        ["tenant", { params: { tenantId: "t1" }, enabled: true }],
      ]);
      const regExecutor = new RedisExecutor<TestEntity>(
        baseMetadata,
        redis.client,
        null,
        registry,
      );

      mockedScanEntityKeys.mockResolvedValueOnce([]);

      await regExecutor.executeFind({} as any, {});

      expect(mockedResolveFilters).toHaveBeenCalledWith(
        expect.anything(),
        registry,
        undefined,
      );
    });
  });
});
