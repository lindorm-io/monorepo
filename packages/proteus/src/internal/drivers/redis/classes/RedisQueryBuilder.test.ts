import type { Dict } from "@lindorm/types";
import type { EntityMetadata, MetaField } from "../../../entity/types/metadata";
import { NotSupportedError } from "../../../../errors/NotSupportedError";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError";
import { RedisDuplicateKeyError } from "../errors/RedisDuplicateKeyError";
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type Mock,
  type MockedFunction,
} from "vitest";

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock("../utils/build-entity-key", () => ({
  buildEntityKey: vi.fn((_target, pkValues, namespace) => {
    const parts = namespace
      ? [namespace, "entity", "test_product"]
      : ["entity", "test_product"];
    return [...parts, ...pkValues].join(":");
  }),
  buildEntityKeyFromRow: vi.fn((_target, row, metadata, namespace) => {
    const parts = namespace
      ? [namespace, "entity", "test_product"]
      : ["entity", "test_product"];
    const pkValues = metadata.primaryKeys.map((pk: string) => row[pk]);
    return [...parts, ...pkValues].join(":");
  }),
}));

vi.mock("../utils/build-scan-pattern", () => ({
  buildScanPattern: vi.fn((_target, namespace) =>
    namespace ? `${namespace}:entity:test_product:*` : "entity:test_product:*",
  ),
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

// ─── Import mocked modules ───────────────────────────────────────────────────

import { scanEntityKeys } from "../utils/scan-entity-keys";
import { resolveFilters } from "../../../utils/query/resolve-filters";
import { RedisQueryBuilder } from "./RedisQueryBuilder";

const mockedScanEntityKeys = scanEntityKeys as MockedFunction<typeof scanEntityKeys>;
const mockedResolveFilters = resolveFilters as MockedFunction<typeof resolveFilters>;

// ─── Test Entities ────────────────────────────────────────────────────────────

class TestProduct {
  id!: string;
  version!: number;
  createdAt!: Date;
  updatedAt!: Date;
  name!: string;
  price!: number | null;
  category!: string;
}

class SoftDeleteProduct {
  id!: string;
  version!: number;
  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;
  name!: string;
}

// ─── Metadata Factories ──────────────────────────────────────────────────────

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

const productFields: Array<MetaField> = [
  makeField("id", "uuid"),
  makeField("version", "integer", "Version"),
  makeField("createdAt", "timestamp", "CreateDate"),
  makeField("updatedAt", "timestamp", "UpdateDate"),
  makeField("name", "string"),
  makeField("price", "integer", "Field", { nullable: true }),
  makeField("category", "string"),
];

const productMetadata: EntityMetadata = {
  target: TestProduct,
  cache: null,
  checks: [],
  defaultOrder: null,
  embeddedLists: [],
  entity: { name: "test_product", namespace: null } as any,
  extras: [],
  fields: productFields,
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

const softDeleteFields: Array<MetaField> = [
  makeField("id", "uuid"),
  makeField("version", "integer", "Version"),
  makeField("createdAt", "timestamp", "CreateDate"),
  makeField("updatedAt", "timestamp", "UpdateDate"),
  makeField("deletedAt", "timestamp", "DeleteDate", { nullable: true }),
  makeField("name", "string"),
];

const softDeleteMetadata: EntityMetadata = {
  ...productMetadata,
  target: SoftDeleteProduct,
  entity: { name: "soft_delete_product", namespace: null } as any,
  fields: softDeleteFields,
} as unknown as EntityMetadata;

// ─── Mock Redis ───────────────────────────────────────────────────────────────

const createMockPipeline = (results: Array<[Error | null, any]> = []) => {
  const pipeline: any = {
    hgetall: vi.fn().mockReturnThis(),
    hset: vi.fn().mockReturnThis(),
    hdel: vi.fn().mockReturnThis(),
    del: vi.fn().mockReturnThis(),
    exec: vi.fn(async () => results),
  };
  return pipeline;
};

const createMockRedis = () => {
  const redis: any = {
    scan: vi.fn(),
    hgetall: vi.fn(),
    hset: vi.fn(),
    hdel: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    incr: vi.fn(),
    pipeline: vi.fn(),
  };
  return redis;
};

// ─── Hash helpers ────────────────────────────────────────────────────────────

const makeHash = (row: Dict): Record<string, string> => {
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
};

// ─── Setup helpers ──────────────────────────────────────────────────────────

const setupScanWithHashes = (
  redis: any,
  entries: Array<{ key: string; hash: Record<string, string> }>,
) => {
  const keys = entries.map((e) => e.key);
  mockedScanEntityKeys.mockResolvedValueOnce(keys);
  const pipelineResults = entries.map((e) => [null, e.hash] as [Error | null, any]);
  redis.pipeline.mockReturnValueOnce(createMockPipeline(pipelineResults));
};

const setupEmptyScan = () => {
  mockedScanEntityKeys.mockResolvedValueOnce([]);
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("RedisQueryBuilder", () => {
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    vi.clearAllMocks();
    redis = createMockRedis();
  });

  // ─── Unsupported methods ─────────────────────────────────────────

  describe("unsupported methods", () => {
    const unsupportedMethods = [
      "whereRaw",
      "andWhereRaw",
      "orWhereRaw",
      "selectRaw",
      "groupBy",
      "having",
      "andHaving",
      "orHaving",
      "havingRaw",
      "andHavingRaw",
      "orHavingRaw",
      "window",
    ] as const;

    for (const method of unsupportedMethods) {
      test(`${method}() throws NotSupportedError`, () => {
        const qb = new RedisQueryBuilder(productMetadata, redis, null);
        expect(() => (qb as any)[method]()).toThrow(NotSupportedError);
      });
    }
  });

  // ─── Lock mode ───────────────────────────────────────────────────

  describe("lock", () => {
    test("throws NotSupportedError for pessimistic_read (F-032)", () => {
      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      expect(() => qb.lock("pessimistic_read")).toThrow(NotSupportedError);
    });

    test("throws NotSupportedError for pessimistic_write (F-032)", () => {
      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      expect(() => qb.lock("pessimistic_write")).toThrow(NotSupportedError);
    });

    test("throws for skip variants", () => {
      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      expect(() => qb.lock("pessimistic_read_skip")).toThrow(NotSupportedError);
      expect(() => qb.lock("pessimistic_write_skip")).toThrow(NotSupportedError);
    });

    test("throws for fail variants", () => {
      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      expect(() => qb.lock("pessimistic_read_fail")).toThrow(NotSupportedError);
      expect(() => qb.lock("pessimistic_write_fail")).toThrow(NotSupportedError);
    });
  });

  // ─── toQuery / clone ────────────────────────────────────────────

  describe("toQuery / clone", () => {
    test("toQuery returns state and driver identifier", () => {
      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      expect(qb.toQuery()).toMatchSnapshot();
    });

    test("clone produces independent copy", () => {
      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      qb.where({ name: "test" } as any);
      const cloned = qb.clone();

      // Modifying original should not affect clone
      qb.andWhere({ category: "x" } as any);

      const origQuery = qb.toQuery() as any;
      const clonedQuery = cloned.toQuery() as any;

      expect(origQuery.state.predicates).toHaveLength(2);
      expect(clonedQuery.state.predicates).toHaveLength(1);
    });
  });

  // ─── getOne / getOneOrFail ──────────────────────────────────────

  describe("getOne", () => {
    test("returns entity for PK-exact match via HGETALL", async () => {
      const hash = makeHash({
        id: "abc-123",
        version: 1,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        name: "Alpha",
        price: 10,
        category: "electronics",
      });

      redis.hgetall.mockResolvedValueOnce(hash);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = await qb.where({ id: "abc-123" } as any).getOne();

      expect(result).not.toBeNull();
      expect(result!.name).toBe("Alpha");
      expect(redis.hgetall).toHaveBeenCalled();
    });

    test("returns null when no match", async () => {
      redis.hgetall.mockResolvedValueOnce({});

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = await qb.where({ id: "nonexistent" } as any).getOne();

      expect(result).toBeNull();
    });

    test("returns first result via SCAN for non-PK query", async () => {
      const entries = [
        {
          key: "entity:test_product:a",
          hash: makeHash({
            id: "a",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "Alpha",
            price: 10,
            category: "x",
          }),
        },
      ];
      setupScanWithHashes(redis, entries);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = await qb.where({ name: "Alpha" } as any).getOne();

      expect(result).not.toBeNull();
      expect(result!.name).toBe("Alpha");
    });
  });

  describe("getOneOrFail", () => {
    test("throws ProteusRepositoryError when not found", async () => {
      redis.hgetall.mockResolvedValueOnce({});

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      await expect(qb.where({ id: "missing" } as any).getOneOrFail()).rejects.toThrow(
        ProteusRepositoryError,
      );
    });

    test("returns entity when found", async () => {
      const hash = makeHash({
        id: "found-1",
        version: 1,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        name: "Found",
        price: 5,
        category: "books",
      });
      redis.hgetall.mockResolvedValueOnce(hash);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = await qb.where({ id: "found-1" } as any).getOneOrFail();

      expect(result.name).toBe("Found");
    });
  });

  // ─── getMany ────────────────────────────────────────────────────

  describe("getMany", () => {
    test("returns all rows via SCAN + pipeline", async () => {
      const entries = [
        {
          key: "entity:test_product:a",
          hash: makeHash({
            id: "a",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "A",
            price: 10,
            category: "books",
          }),
        },
        {
          key: "entity:test_product:b",
          hash: makeHash({
            id: "b",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "B",
            price: 20,
            category: "electronics",
          }),
        },
      ];
      setupScanWithHashes(redis, entries);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const results = await qb.getMany();

      expect(results).toHaveLength(2);
    });

    test("filters by where predicate", async () => {
      const entries = [
        {
          key: "entity:test_product:a",
          hash: makeHash({
            id: "a",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "A",
            price: 10,
            category: "books",
          }),
        },
        {
          key: "entity:test_product:b",
          hash: makeHash({
            id: "b",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "B",
            price: 20,
            category: "electronics",
          }),
        },
      ];
      setupScanWithHashes(redis, entries);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const results = await qb.where({ category: "books" } as any).getMany();

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("A");
    });

    test("applies orderBy ASC", async () => {
      const entries = [
        {
          key: "entity:test_product:a",
          hash: makeHash({
            id: "a",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "A",
            price: 30,
            category: "x",
          }),
        },
        {
          key: "entity:test_product:b",
          hash: makeHash({
            id: "b",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "B",
            price: 10,
            category: "x",
          }),
        },
        {
          key: "entity:test_product:c",
          hash: makeHash({
            id: "c",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "C",
            price: 20,
            category: "x",
          }),
        },
      ];
      setupScanWithHashes(redis, entries);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const results = await qb.orderBy({ price: "ASC" } as any).getMany();

      const prices = results.map((r: any) => r.price);
      expect(prices).toEqual([10, 20, 30]);
    });

    test("applies orderBy DESC", async () => {
      const entries = [
        {
          key: "entity:test_product:a",
          hash: makeHash({
            id: "a",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "A",
            price: 30,
            category: "x",
          }),
        },
        {
          key: "entity:test_product:b",
          hash: makeHash({
            id: "b",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "B",
            price: 10,
            category: "x",
          }),
        },
        {
          key: "entity:test_product:c",
          hash: makeHash({
            id: "c",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "C",
            price: 20,
            category: "x",
          }),
        },
      ];
      setupScanWithHashes(redis, entries);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const results = await qb.orderBy({ price: "DESC" } as any).getMany();

      const prices = results.map((r: any) => r.price);
      expect(prices).toEqual([30, 20, 10]);
    });

    test("applies skip and take for pagination", async () => {
      const entries = [
        {
          key: "entity:test_product:a",
          hash: makeHash({
            id: "a",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "A",
            price: 10,
            category: "x",
          }),
        },
        {
          key: "entity:test_product:b",
          hash: makeHash({
            id: "b",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "B",
            price: 20,
            category: "x",
          }),
        },
        {
          key: "entity:test_product:c",
          hash: makeHash({
            id: "c",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "C",
            price: 30,
            category: "x",
          }),
        },
      ];
      setupScanWithHashes(redis, entries);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const results = await qb
        .orderBy({ name: "ASC" } as any)
        .skip(1)
        .take(1)
        .getMany();

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("B");
    });

    test("select projects only requested fields", async () => {
      const entries = [
        {
          key: "entity:test_product:a",
          hash: makeHash({
            id: "a",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "A",
            price: 10,
            category: "x",
          }),
        },
      ];
      setupScanWithHashes(redis, entries);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const results = await qb.select("name" as any).getMany();

      expect(results[0]).toMatchSnapshot();
    });

    test("returns empty for no keys", async () => {
      setupEmptyScan();

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const results = await qb.getMany();

      expect(results).toHaveLength(0);
    });
  });

  // ─── getManyAndCount ─────────────────────────────────────────────

  describe("getManyAndCount", () => {
    test("returns paginated results and total count", async () => {
      const entries = Array.from({ length: 5 }, (_, i) => ({
        key: `entity:test_product:${i}`,
        hash: makeHash({
          id: `id-${i}`,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          name: `Item ${i}`,
          price: i * 10,
          category: "misc",
        }),
      }));
      setupScanWithHashes(redis, entries);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const [entities, total] = await qb.skip(1).take(2).getManyAndCount();

      expect(total).toBe(5);
      expect(entities).toHaveLength(2);
    });

    test("total count ignores pagination", async () => {
      const entries = Array.from({ length: 5 }, (_, i) => ({
        key: `entity:test_product:${i}`,
        hash: makeHash({
          id: `id-${i}`,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          name: `Item ${i}`,
          price: i * 10,
          category: "misc",
        }),
      }));
      setupScanWithHashes(redis, entries);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const [, total] = await qb.take(1).getManyAndCount();

      expect(total).toBe(5);
    });
  });

  // ─── count / exists ──────────────────────────────────────────────

  describe("count", () => {
    test("returns total number of matching rows", async () => {
      const entries = [
        {
          key: "entity:test_product:a",
          hash: makeHash({
            id: "a",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "X",
            price: 1,
            category: "cat",
          }),
        },
        {
          key: "entity:test_product:b",
          hash: makeHash({
            id: "b",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "Y",
            price: 2,
            category: "cat",
          }),
        },
      ];
      setupScanWithHashes(redis, entries);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const count = await qb.count();

      expect(count).toBe(2);
    });

    test("count with where predicate", async () => {
      const entries = [
        {
          key: "entity:test_product:a",
          hash: makeHash({
            id: "a",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "X",
            price: 1,
            category: "cat",
          }),
        },
        {
          key: "entity:test_product:b",
          hash: makeHash({
            id: "b",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "Y",
            price: 2,
            category: "cat",
          }),
        },
      ];
      setupScanWithHashes(redis, entries);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const count = await qb.where({ name: "X" } as any).count();

      expect(count).toBe(1);
    });
  });

  describe("exists", () => {
    test("returns true when rows exist", async () => {
      const entries = [
        {
          key: "entity:test_product:a",
          hash: makeHash({
            id: "a",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "X",
            price: 1,
            category: "cat",
          }),
        },
      ];
      setupScanWithHashes(redis, entries);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = await qb.exists();

      expect(result).toBe(true);
    });

    test("returns false when no rows match", async () => {
      setupEmptyScan();

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = await qb.where({ name: "NotHere" } as any).exists();

      expect(result).toBe(false);
    });
  });

  // ─── Aggregates ──────────────────────────────────────────────────

  describe("aggregates", () => {
    const aggEntries = [
      {
        key: "entity:test_product:a",
        hash: makeHash({
          id: "a",
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          name: "A",
          price: 10,
          category: "agg",
        }),
      },
      {
        key: "entity:test_product:b",
        hash: makeHash({
          id: "b",
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          name: "B",
          price: 20,
          category: "agg",
        }),
      },
      {
        key: "entity:test_product:c",
        hash: makeHash({
          id: "c",
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          name: "C",
          price: 30,
          category: "agg",
        }),
      },
    ];

    test("sum returns total of field values", async () => {
      setupScanWithHashes(redis, aggEntries);
      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = await qb.sum("price" as any);
      expect(result).toBe(60);
    });

    test("average returns mean of field values", async () => {
      setupScanWithHashes(redis, aggEntries);
      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = await qb.average("price" as any);
      expect(result).toBe(20);
    });

    test("minimum returns lowest value", async () => {
      setupScanWithHashes(redis, aggEntries);
      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = await qb.minimum("price" as any);
      expect(result).toBe(10);
    });

    test("maximum returns highest value", async () => {
      setupScanWithHashes(redis, aggEntries);
      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = await qb.maximum("price" as any);
      expect(result).toBe(30);
    });

    test("aggregates return null for empty result set", async () => {
      setupEmptyScan();
      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      expect(await qb.sum("price" as any)).toBeNull();
    });

    test("sum ignores null values", async () => {
      const entries = [
        {
          key: "entity:test_product:a",
          hash: makeHash({
            id: "a",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "WithNull",
            category: "agg",
          }),
        },
        {
          key: "entity:test_product:b",
          hash: makeHash({
            id: "b",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "WithValue",
            price: 50,
            category: "agg",
          }),
        },
      ];
      setupScanWithHashes(redis, entries);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = await qb.sum("price" as any);
      expect(result).toBe(50);
    });
  });

  // ─── getRawRows ──────────────────────────────────────────────────

  describe("getRawRows", () => {
    test("returns raw deserialized rows", async () => {
      const entries = [
        {
          key: "entity:test_product:a",
          hash: makeHash({
            id: "a",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "RawTest",
            price: 7,
            category: "raw",
          }),
        },
      ];
      setupScanWithHashes(redis, entries);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const rows = await qb.getRawRows();

      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveProperty("name", "RawTest");
    });
  });

  // ─── distinct ────────────────────────────────────────────────────

  describe("distinct", () => {
    test("removes duplicate projected rows", async () => {
      const entries = [
        {
          key: "entity:test_product:a",
          hash: makeHash({
            id: "a",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "Dup",
            price: 10,
            category: "x",
          }),
        },
        {
          key: "entity:test_product:b",
          hash: makeHash({
            id: "b",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "Dup",
            price: 10,
            category: "x",
          }),
        },
        {
          key: "entity:test_product:c",
          hash: makeHash({
            id: "c",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "Unique",
            price: 20,
            category: "x",
          }),
        },
      ];
      setupScanWithHashes(redis, entries);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const results = await qb
        .select("name" as any, "price" as any)
        .distinct()
        .getMany();

      const dupRows = results.filter((r: any) => r.name === "Dup");
      expect(dupRows).toHaveLength(1);
    });
  });

  // ─── OR predicate ─────────────────────────────────────────────────

  describe("OR predicate", () => {
    test("orWhere unions result sets", async () => {
      const entries = [
        {
          key: "entity:test_product:a",
          hash: makeHash({
            id: "a",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "A",
            price: 10,
            category: "x",
          }),
        },
        {
          key: "entity:test_product:b",
          hash: makeHash({
            id: "b",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "B",
            price: 20,
            category: "y",
          }),
        },
        {
          key: "entity:test_product:c",
          hash: makeHash({
            id: "c",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "C",
            price: 30,
            category: "z",
          }),
        },
      ];
      setupScanWithHashes(redis, entries);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const results = await qb
        .where({ category: "x" } as any)
        .orWhere({ category: "z" } as any)
        .getMany();

      expect(results).toHaveLength(2);
      const names = results.map((r: any) => r.name).sort();
      expect(names).toEqual(["A", "C"]);
    });
  });

  // ─── setFilter / withoutScope ────────────────────────────────────

  describe("setFilter / withoutScope", () => {
    test("setFilter is chainable", () => {
      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = qb.setFilter("test", { tenantId: "abc" });
      expect(result).toBe(qb);
    });

    test("withoutScope is chainable", () => {
      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = qb.withoutScope();
      expect(result).toBe(qb);
    });

    test("withDeleted is chainable", () => {
      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = qb.withDeleted();
      expect(result).toBe(qb);
    });
  });

  // ─── Insert builder ─────────────────────────────────────────────

  describe("insert builder", () => {
    test("inserts a row via HSET", async () => {
      redis.exists.mockResolvedValueOnce(0);
      redis.hset.mockResolvedValueOnce(7);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = await qb
        .insert()
        .values([
          {
            id: "manual-1",
            name: "Manual A",
            price: 5,
            category: "test",
            version: 1,
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
          } as any,
        ])
        .execute();

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].name).toBe("Manual A");
      // T-011: Verify redis.hset was called with the serialized hash content
      expect(redis.hset).toHaveBeenCalled();
      expect(redis.hset.mock.calls[0]).toMatchSnapshot();
    });

    test("throws on duplicate primary key", async () => {
      redis.exists.mockResolvedValueOnce(1);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      await expect(
        qb
          .insert()
          .values([
            {
              id: "dup-1",
              name: "Dup",
              price: 1,
              category: "x",
              version: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as any,
          ])
          .execute(),
      ).rejects.toThrow(RedisDuplicateKeyError);
    });

    test("returning() is a no-op (chainable)", () => {
      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const builder = qb.insert().returning("id" as any);
      expect(builder).toBeDefined();
    });
  });

  // ─── Update builder ─────────────────────────────────────────────

  describe("update builder", () => {
    test("updates matching rows via pipeline", async () => {
      const entries = [
        {
          key: "entity:test_product:a",
          hash: makeHash({
            id: "a",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "BeforeUpdate",
            price: 10,
            category: "upd",
          }),
        },
      ];
      setupScanWithHashes(redis, entries);
      // Pipeline for the update HSET
      redis.pipeline.mockReturnValueOnce(createMockPipeline([[null, "OK"]]));

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = await qb
        .update()
        .set({ price: 99 } as any)
        .where({ name: "BeforeUpdate" } as any)
        .execute();

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].price).toBe(99);
    });

    test("returns empty when no rows match predicate", async () => {
      const entries = [
        {
          key: "entity:test_product:a",
          hash: makeHash({
            id: "a",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "X",
            price: 10,
            category: "upd",
          }),
        },
      ];
      setupScanWithHashes(redis, entries);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = await qb
        .update()
        .set({ price: 99 } as any)
        .where({ name: "Nonexistent" } as any)
        .execute();

      expect(result.rowCount).toBe(0);
    });

    test("returns empty when SCAN finds no keys", async () => {
      setupEmptyScan();

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = await qb
        .update()
        .set({ price: 99 } as any)
        .where({ name: "X" } as any)
        .execute();

      expect(result.rowCount).toBe(0);
    });

    test("returns empty when no update data set", async () => {
      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = await qb
        .update()
        .where({ name: "X" } as any)
        .execute();

      expect(result.rowCount).toBe(0);
    });
  });

  // ─── Delete builder ─────────────────────────────────────────────

  describe("delete builder", () => {
    test("hard deletes matching rows via pipeline", async () => {
      const entries = [
        {
          key: "entity:test_product:a",
          hash: makeHash({
            id: "a",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "ToDelete",
            price: 1,
            category: "del",
          }),
        },
      ];
      setupScanWithHashes(redis, entries);
      // Pipeline for the DEL commands
      redis.pipeline.mockReturnValueOnce(createMockPipeline([[null, 1]]));

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = await qb
        .delete()
        .where({ name: "ToDelete" } as any)
        .execute();

      expect(result.rowCount).toBe(1);
    });

    test("returns empty when SCAN finds no keys", async () => {
      setupEmptyScan();

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = await qb
        .delete()
        .where({ name: "Nonexistent" } as any)
        .execute();

      expect(result.rowCount).toBe(0);
    });

    test("returns empty when no rows match predicate", async () => {
      const entries = [
        {
          key: "entity:test_product:a",
          hash: makeHash({
            id: "a",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "X",
            price: 1,
            category: "del",
          }),
        },
      ];
      setupScanWithHashes(redis, entries);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const result = await qb
        .delete()
        .where({ name: "Nonexistent" } as any)
        .execute();

      expect(result.rowCount).toBe(0);
    });
  });

  // ─── Soft delete builder ──────────────────────────────────────────

  describe("softDelete builder", () => {
    test("sets deletedAt via HSET instead of removing row", async () => {
      const entries = [
        {
          key: "entity:soft_delete_product:a",
          hash: makeHash({
            id: "a",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "ToSoftDelete",
          }),
        },
      ];
      setupScanWithHashes(redis, entries);
      // Pipeline for the soft-delete HSET
      redis.pipeline.mockReturnValueOnce(createMockPipeline([[null, 1]]));

      const qb = new RedisQueryBuilder(softDeleteMetadata, redis, null);
      const result = await qb
        .softDelete()
        .where({ name: "ToSoftDelete" } as any)
        .execute();

      expect(result.rowCount).toBe(1);
    });
  });

  // ─── Soft delete filter on reads ──────────────────────────────────

  describe("soft-delete filter on reads", () => {
    test("excludes soft-deleted rows when resolveFilters applies", async () => {
      // Mock resolveFilters to return a __softDelete filter predicate
      mockedResolveFilters.mockReturnValueOnce([
        { name: "__softDelete", predicate: { deletedAt: null } },
      ]);

      const entries = [
        {
          key: "entity:soft_delete_product:a",
          hash: makeHash({
            id: "a",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "Active",
          }),
        },
        {
          key: "entity:soft_delete_product:b",
          hash: {
            id: "b",
            version: "1",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deletedAt: new Date().toISOString(),
            name: "Deleted",
          },
        },
      ];
      setupScanWithHashes(redis, entries);

      const qb = new RedisQueryBuilder(softDeleteMetadata, redis, null);
      const results = await qb.getMany();

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Active");
    });
  });

  // ─── andWhere ────────────────────────────────────────────────────

  describe("andWhere", () => {
    test("narrows result set with AND condition", async () => {
      const entries = [
        {
          key: "entity:test_product:a",
          hash: makeHash({
            id: "a",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "A",
            price: 10,
            category: "books",
          }),
        },
        {
          key: "entity:test_product:b",
          hash: makeHash({
            id: "b",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: "B",
            price: 10,
            category: "electronics",
          }),
        },
      ];
      setupScanWithHashes(redis, entries);

      const qb = new RedisQueryBuilder(productMetadata, redis, null);
      const results = await qb
        .where({ price: 10 } as any)
        .andWhere({ category: "books" } as any)
        .getMany();

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("A");
    });
  });
});
