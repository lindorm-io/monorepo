// ─── CachingRepository Unit Tests ────────────────────────────────────────────
//
// All external dependencies (ICacheAdapter, IProteusRepository, EntityMetadata,
// defaultHydrateEntity, runHooksAsync) are mocked so that every test is a pure
// unit test. No DB or adapter I/O occurs.

import type { ILogger } from "@lindorm/logger";
import type { ICacheAdapter } from "../../interfaces/CacheAdapter";
import type { IProteusRepository } from "../../interfaces";
import type { EntityMetadata } from "../entity/types/metadata";
import type { IEntity } from "../../interfaces";
import { ProteusRepositoryError } from "../../errors/ProteusRepositoryError";
import { CachingRepository } from "./CachingRepository";
import { beforeEach, describe, expect, it, vi, type Mock, type Mocked } from "vitest";

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock("../entity/utils/default-hydrate-entity", async () => ({
  defaultHydrateEntity: vi.fn(),
}));

vi.mock("../entity/utils/run-hooks-async", () => ({
  runHooksAsync: vi.fn().mockResolvedValue(undefined),
}));

import { defaultHydrateEntity } from "../entity/utils/default-hydrate-entity";
import { runHooksAsync } from "../entity/utils/run-hooks-async";

// ─── Entity Fixture ───────────────────────────────────────────────────────────

class TestEntity implements IEntity {
  id!: string;
  version!: number;
  createdAt!: Date;
  updatedAt!: Date;
  name!: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const createMockLogger = (): ILogger =>
  ({
    child: vi.fn().mockReturnThis(),
    silly: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }) as unknown as ILogger;

const createMockAdapter = (): Mocked<ICacheAdapter> => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
  delByPrefix: vi.fn().mockResolvedValue(undefined),
});

const createMockInner = (): Mocked<IProteusRepository<TestEntity>> =>
  ({
    create: vi.fn().mockReturnValue(new TestEntity()),
    copy: vi.fn().mockReturnValue(new TestEntity()),
    validate: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
    exists: vi.fn().mockResolvedValue(false),
    find: vi.fn().mockResolvedValue([]),
    findAndCount: vi.fn().mockResolvedValue([[], 0]),
    findOne: vi.fn().mockResolvedValue(null),
    findOneOrFail: vi.fn().mockResolvedValue(new TestEntity()),
    findOneOrSave: vi.fn().mockResolvedValue(new TestEntity()),
    upsert: vi.fn().mockResolvedValue(new TestEntity()),
    insert: vi.fn().mockResolvedValue(new TestEntity()),
    save: vi.fn().mockResolvedValue(new TestEntity()),
    update: vi.fn().mockResolvedValue(new TestEntity()),
    clone: vi.fn().mockResolvedValue(new TestEntity()),
    destroy: vi.fn().mockResolvedValue(undefined),
    softDestroy: vi.fn().mockResolvedValue(undefined),
    increment: vi.fn().mockResolvedValue(undefined),
    decrement: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    updateMany: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined),
    versions: vi.fn().mockResolvedValue([]),
    sum: vi.fn().mockResolvedValue(null),
    average: vi.fn().mockResolvedValue(null),
    minimum: vi.fn().mockResolvedValue(null),
    maximum: vi.fn().mockResolvedValue(null),
    ttl: vi.fn().mockResolvedValue(0),
    deleteExpired: vi.fn().mockResolvedValue(undefined),
    cursor: vi.fn().mockResolvedValue({}),
    stream: vi.fn().mockReturnValue({ [Symbol.asyncIterator]: vi.fn() }),
    clear: vi.fn().mockResolvedValue(undefined),
    queryBuilder: vi.fn().mockReturnValue({}),
    setup: vi.fn().mockResolvedValue(undefined),
  }) as unknown as Mocked<IProteusRepository<TestEntity>>;

const makeBaseMetadata = (overrides: Partial<EntityMetadata> = {}): EntityMetadata =>
  ({
    target: TestEntity,
    cache: { ttlMs: 60_000 }, // 1 minute — enables caching by default in tests
    checks: [],
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
        enum: null,
        default: null,
        hideOn: [],
        max: null,
        min: null,
        name: "id",
        nullable: false,

        precision: null,
        readonly: true,
        scale: null,
        schema: null,
        transform: null,
        type: "uuid",
      },
      {
        key: "name",
        decorator: "Field",
        arrayType: null,
        collation: null,
        comment: null,
        computed: null,
        enum: null,
        default: null,
        hideOn: [],
        max: null,
        min: null,
        name: "name",
        nullable: false,

        precision: null,
        readonly: false,
        scale: null,
        schema: null,
        transform: null,
        type: "string",
      },
    ],
    generated: [],
    hooks: [],
    indexes: [],
    primaryKeys: ["id"],
    relationIds: [],
    relationCounts: [],
    relations: [],
    schemas: [],
    uniques: [],
    versionKeys: [],
    ...overrides,
  }) as unknown as EntityMetadata;

// ─── Factory ──────────────────────────────────────────────────────────────────

const createRepo = (
  opts: {
    metadata?: EntityMetadata;
    sourceTtlMs?: number;
    namespace?: string | null;
  } = {},
) => {
  const adapter = createMockAdapter();
  const inner = createMockInner();
  const logger = createMockLogger();
  const metadata = opts.metadata ?? makeBaseMetadata();

  const repo = new CachingRepository<TestEntity>({
    inner,
    adapter,
    metadata,
    namespace: opts.namespace ?? null,
    sourceTtlMs: opts.sourceTtlMs,
    logger,
  });

  return { repo, adapter, inner, logger, metadata };
};

// ─── Shared entity fixtures ───────────────────────────────────────────────────

const entityA = Object.assign(new TestEntity(), {
  id: "id-1",
  version: 1,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  name: "Entity A",
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CachingRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // By default, defaultHydrateEntity returns a plain TestEntity.
    // Individual tests override this when they need entity data back.
    (defaultHydrateEntity as Mock).mockReturnValue(new TestEntity());
  });

  // ─── Category C: Passthrough methods ────────────────────────────────────────

  describe("passthrough methods", () => {
    it("should delegate create() to inner without touching adapter", () => {
      const { repo, inner, adapter } = createRepo();
      inner.create.mockReturnValue(entityA);

      const result = repo.create();

      expect(result).toBe(entityA);
      expect(inner.create).toHaveBeenCalledTimes(1);
      expect(adapter.get).not.toHaveBeenCalled();
    });

    it("should delegate copy() to inner without touching adapter", () => {
      const { repo, inner, adapter } = createRepo();
      inner.copy.mockReturnValue(entityA);

      const result = repo.copy(entityA);

      expect(result).toBe(entityA);
      expect(inner.copy).toHaveBeenCalledWith(entityA);
      expect(adapter.get).not.toHaveBeenCalled();
    });

    it("should delegate validate() to inner without touching adapter", () => {
      const { repo, inner, adapter } = createRepo();

      repo.validate(entityA);

      expect(inner.validate).toHaveBeenCalledWith(entityA);
      expect(adapter.get).not.toHaveBeenCalled();
    });

    it("should delegate ttl() to inner without touching adapter", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.ttl.mockResolvedValue(30);

      const result = await repo.ttl({ id: "id-1" });

      expect(result).toBe(30);
      expect(inner.ttl).toHaveBeenCalledWith({ id: "id-1" }, undefined);
      expect(adapter.get).not.toHaveBeenCalled();
    });

    it("should delegate cursor() to inner without touching adapter", async () => {
      const { repo, inner, adapter } = createRepo();
      const fakeCursor = {} as any;
      inner.cursor.mockResolvedValue(fakeCursor);

      const result = await repo.cursor();

      expect(result).toBe(fakeCursor);
      expect(adapter.get).not.toHaveBeenCalled();
    });

    it("should delegate stream() to inner without touching adapter", () => {
      const { repo, inner, adapter } = createRepo();
      const fakeStream = { [Symbol.asyncIterator]: vi.fn() } as any;
      inner.stream.mockReturnValue(fakeStream);

      const result = repo.stream();

      expect(result).toBe(fakeStream);
      expect(adapter.get).not.toHaveBeenCalled();
    });

    it("should delegate versions() to inner without touching adapter", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.versions.mockResolvedValue([entityA]);

      const result = await repo.versions({ id: "id-1" });

      expect(result).toEqual([entityA]);
      expect(adapter.get).not.toHaveBeenCalled();
    });

    it("should delegate sum() to inner without touching adapter", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.sum.mockResolvedValue(42);

      const result = await repo.sum("version");

      expect(result).toBe(42);
      expect(adapter.get).not.toHaveBeenCalled();
    });

    it("should delegate average() to inner without touching adapter", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.average.mockResolvedValue(3.5);

      const result = await repo.average("version");

      expect(result).toBe(3.5);
      expect(adapter.get).not.toHaveBeenCalled();
    });

    it("should delegate minimum() to inner without touching adapter", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.minimum.mockResolvedValue(1);

      const result = await repo.minimum("version");

      expect(result).toBe(1);
      expect(adapter.get).not.toHaveBeenCalled();
    });

    it("should delegate maximum() to inner without touching adapter", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.maximum.mockResolvedValue(99);

      const result = await repo.maximum("version");

      expect(result).toBe(99);
      expect(adapter.get).not.toHaveBeenCalled();
    });

    it("should delegate queryBuilder() to inner without touching adapter", () => {
      const { repo, inner, adapter } = createRepo();
      const fakeQb = {} as any;
      inner.queryBuilder.mockReturnValue(fakeQb);

      const result = repo.queryBuilder();

      expect(result).toBe(fakeQb);
      expect(adapter.get).not.toHaveBeenCalled();
    });

    it("should delegate setup() to inner without touching adapter", async () => {
      const { repo, inner, adapter } = createRepo();

      await repo.setup();

      expect(inner.setup).toHaveBeenCalledTimes(1);
      expect(adapter.get).not.toHaveBeenCalled();
    });
  });

  // ─── Category A: find() ──────────────────────────────────────────────────────

  describe("find()", () => {
    it("should call adapter.get on cache miss then adapter.set with result", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.find.mockResolvedValue([entityA]);
      adapter.get.mockResolvedValue(null);
      (defaultHydrateEntity as Mock).mockReturnValue(entityA);

      await repo.find({ name: "Entity A" });

      expect(adapter.get).toHaveBeenCalledTimes(1);
      expect(inner.find).toHaveBeenCalledTimes(1);
      expect(adapter.set).toHaveBeenCalledTimes(1);
    });

    it("should return inner result on cache miss without calling adapter.set on serialization error", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.find.mockResolvedValue([entityA]);
      adapter.get.mockResolvedValue(null);
      adapter.set.mockRejectedValue(new Error("cache down"));

      const result = await repo.find({ name: "Entity A" });

      // Result still returned despite set failure
      expect(result).toEqual([entityA]);
    });

    it("should return deserialized entities on cache hit without calling inner", async () => {
      const { repo, inner, adapter } = createRepo();
      const serialized = JSON.stringify([{ id: "id-1", name: "Entity A" }]);
      adapter.get.mockResolvedValue(serialized);
      (defaultHydrateEntity as Mock).mockReturnValue(entityA);

      const result = await repo.find({ name: "Entity A" });

      expect(result).toHaveLength(1);
      expect(inner.find).not.toHaveBeenCalled();
      expect(adapter.set).not.toHaveBeenCalled();
    });

    it("should skip cache when cache:false is set in options", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.find.mockResolvedValue([entityA]);

      await repo.find({ name: "Entity A" }, { cache: false });

      expect(adapter.get).not.toHaveBeenCalled();
      expect(adapter.set).not.toHaveBeenCalled();
      expect(inner.find).toHaveBeenCalledTimes(1);
    });

    it("should skip cache when relations option is non-empty", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.find.mockResolvedValue([entityA]);

      await repo.find({ name: "Entity A" }, { relations: ["items" as any] });

      expect(adapter.get).not.toHaveBeenCalled();
      expect(adapter.set).not.toHaveBeenCalled();
    });

    it("should skip cache when lock option is set", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.find.mockResolvedValue([entityA]);

      await repo.find({ name: "Entity A" }, { lock: "pessimistic_read" });

      expect(adapter.get).not.toHaveBeenCalled();
      expect(adapter.set).not.toHaveBeenCalled();
    });

    it("should skip cache when entity has binary fields", async () => {
      const metadata = makeBaseMetadata({
        fields: [
          {
            key: "data",
            decorator: "Field",
            arrayType: null,
            collation: null,
            comment: null,
            computed: null,
            enum: null,
            default: null,
            hideOn: [],
            max: null,
            min: null,
            name: "data",
            nullable: false,

            precision: null,
            readonly: false,
            scale: null,
            schema: null,
            transform: null,
            type: "binary",
          },
        ] as any,
      });
      const { repo, inner, adapter } = createRepo({ metadata });
      inner.find.mockResolvedValue([entityA]);

      await repo.find({ name: "Entity A" });

      expect(adapter.get).not.toHaveBeenCalled();
      expect(adapter.set).not.toHaveBeenCalled();
    });

    it("should skip cache when entity has eager relations", async () => {
      const metadata = makeBaseMetadata({
        relations: [
          {
            key: "items",
            type: "OneToMany",
            foreignConstructor: () => TestEntity,
            foreignKey: "parentId",
            findKeys: { parentId: "id" },
            joinKeys: null,
            joinTable: null,
            orderBy: null,
            options: {
              deferrable: false,
              initiallyDeferred: false,
              loading: { single: "eager", multiple: "eager" },
              nullable: false,
              onDestroy: "cascade",
              onInsert: "cascade",
              onOrphan: "ignore",
              onSoftDestroy: "ignore",
              onUpdate: "cascade",
              strategy: null,
            },
          },
        ] as any,
      });
      const { repo, inner, adapter } = createRepo({ metadata });
      inner.find.mockResolvedValue([entityA]);

      await repo.find({ name: "Entity A" });

      expect(adapter.get).not.toHaveBeenCalled();
      expect(adapter.set).not.toHaveBeenCalled();
    });

    it("should skip cache when entity has lazy relations", async () => {
      const metadata = makeBaseMetadata({
        relations: [
          {
            key: "parent",
            type: "ManyToOne",
            foreignConstructor: () => TestEntity,
            foreignKey: "id",
            findKeys: null,
            joinKeys: { parentId: "id" },
            joinTable: null,
            orderBy: null,
            options: {
              deferrable: false,
              initiallyDeferred: false,
              loading: { single: "lazy", multiple: "lazy" },
              nullable: true,
              onDestroy: "ignore",
              onInsert: "ignore",
              onOrphan: "ignore",
              onSoftDestroy: "ignore",
              onUpdate: "ignore",
              strategy: null,
            },
          },
        ] as any,
      });
      const { repo, inner, adapter } = createRepo({ metadata });
      inner.find.mockResolvedValue([entityA]);

      await repo.find({ name: "Entity A" });

      expect(adapter.get).not.toHaveBeenCalled();
      expect(adapter.set).not.toHaveBeenCalled();
    });

    it("should skip cache entirely when no TTL is resolvable", async () => {
      const metadata = makeBaseMetadata({ cache: null });
      const { repo, inner, adapter } = createRepo({ metadata, sourceTtlMs: undefined });
      inner.find.mockResolvedValue([entityA]);

      await repo.find({ name: "Entity A" });

      expect(adapter.get).not.toHaveBeenCalled();
      expect(adapter.set).not.toHaveBeenCalled();
      expect(inner.find).toHaveBeenCalledTimes(1);
    });

    it("should fall through to inner when adapter.get throws", async () => {
      const { repo, inner, adapter } = createRepo();
      adapter.get.mockRejectedValue(new Error("Redis down"));
      inner.find.mockResolvedValue([entityA]);

      const result = await repo.find({ name: "Entity A" });

      expect(result).toEqual([entityA]);
      expect(inner.find).toHaveBeenCalledTimes(1);
    });

    it("should use sourceTtlMs when no decorator cache is present", async () => {
      const metadata = makeBaseMetadata({ cache: null });
      const { repo, inner, adapter } = createRepo({ metadata, sourceTtlMs: 30_000 });
      inner.find.mockResolvedValue([entityA]);
      adapter.get.mockResolvedValue(null);

      await repo.find({ name: "Entity A" });

      expect(adapter.set).toHaveBeenCalledTimes(1);
      const ttlArg = (adapter.set as Mock).mock.calls[0][2];
      expect(ttlArg).toBe(30_000);
    });

    it("should use decorator ttlMs for adapter.set", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.find.mockResolvedValue([entityA]);
      adapter.get.mockResolvedValue(null);

      await repo.find({ name: "Entity A" });

      expect(adapter.set).toHaveBeenCalledTimes(1);
      const ttlArg = (adapter.set as Mock).mock.calls[0][2];
      expect(ttlArg).toBe(60_000);
    });
  });

  // ─── Category A: findOne() ───────────────────────────────────────────────────

  describe("findOne()", () => {
    it("should return null on cache miss when inner returns null", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.findOne.mockResolvedValue(null);
      adapter.get.mockResolvedValue(null);

      const result = await repo.findOne({ id: "id-1" });

      expect(result).toBeNull();
      expect(adapter.set).toHaveBeenCalledTimes(1); // negative caching: stores empty array
    });

    it("should return entity on cache miss when inner returns entity", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.findOne.mockResolvedValue(entityA);
      adapter.get.mockResolvedValue(null);
      (defaultHydrateEntity as Mock).mockReturnValue(entityA);

      const result = await repo.findOne({ id: "id-1" });

      expect(result).toBe(entityA);
      expect(adapter.set).toHaveBeenCalledTimes(1);
    });

    it("should return entity on cache hit without calling inner", async () => {
      const { repo, inner, adapter } = createRepo();
      const serialized = JSON.stringify([{ id: "id-1", name: "Entity A" }]);
      adapter.get.mockResolvedValue(serialized);
      (defaultHydrateEntity as Mock).mockReturnValue(entityA);

      const result = await repo.findOne({ id: "id-1" });

      expect(result).toBe(entityA);
      expect(inner.findOne).not.toHaveBeenCalled();
    });

    it("should return null on cache hit of empty array (negative caching)", async () => {
      const { repo, inner, adapter } = createRepo();
      const serialized = JSON.stringify([]);
      adapter.get.mockResolvedValue(serialized);

      const result = await repo.findOne({ id: "missing" });

      expect(result).toBeNull();
      expect(inner.findOne).not.toHaveBeenCalled();
    });
  });

  // ─── Category A: findOneOrFail() ─────────────────────────────────────────────

  describe("findOneOrFail()", () => {
    it("should return entity when findOne succeeds", async () => {
      const { repo, inner } = createRepo();
      inner.findOne.mockResolvedValue(entityA);
      adapter: createMockAdapter();

      const result = await repo.findOneOrFail({ id: "id-1" });

      expect(result).toBe(entityA);
    });

    it("should throw ProteusRepositoryError when entity is not found", async () => {
      const { repo, inner } = createRepo();
      inner.findOne.mockResolvedValue(null);
      // cache miss — adapter.get returns null (default mock)

      await expect(repo.findOneOrFail({ id: "missing" })).rejects.toBeInstanceOf(
        ProteusRepositoryError,
      );
    });

    it("should NOT delegate to inner.findOneOrFail — uses own findOne", async () => {
      const { repo, inner } = createRepo();
      inner.findOne.mockResolvedValue(null);

      await expect(repo.findOneOrFail({ id: "missing" })).rejects.toThrow();

      // inner.findOneOrFail must never be called — CachingRepository handles this itself
      expect(inner.findOneOrFail).not.toHaveBeenCalled();
    });
  });

  // ─── Category A: findAndCount() ──────────────────────────────────────────────

  describe("findAndCount()", () => {
    it("should cache [entities, count] as a unit on cache miss", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.findAndCount.mockResolvedValue([[entityA], 1]);
      adapter.get.mockResolvedValue(null);
      (defaultHydrateEntity as Mock).mockReturnValue(entityA);

      const [entities, count] = await repo.findAndCount({ name: "Entity A" });

      expect(count).toBe(1);
      expect(entities).toHaveLength(1);
      expect(adapter.set).toHaveBeenCalledTimes(1);
    });

    it("should return deserialized [entities, count] on cache hit", async () => {
      const { repo, inner, adapter } = createRepo();
      const payload = { entities: [{ id: "id-1", name: "Entity A" }], count: 1 };
      adapter.get.mockResolvedValue(JSON.stringify(payload));
      (defaultHydrateEntity as Mock).mockReturnValue(entityA);

      const [entities, count] = await repo.findAndCount({ name: "Entity A" });

      expect(count).toBe(1);
      expect(entities).toHaveLength(1);
      expect(inner.findAndCount).not.toHaveBeenCalled();
    });

    it("should skip cache when cache:false is set", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.findAndCount.mockResolvedValue([[entityA], 1]);

      await repo.findAndCount({ name: "Entity A" }, { cache: false });

      expect(adapter.get).not.toHaveBeenCalled();
      expect(adapter.set).not.toHaveBeenCalled();
    });
  });

  // ─── Category A: count() ─────────────────────────────────────────────────────

  describe("count()", () => {
    it("should cache number on cache miss", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.count.mockResolvedValue(5);
      adapter.get.mockResolvedValue(null);

      const result = await repo.count({ name: "Entity A" });

      expect(result).toBe(5);
      expect(adapter.set).toHaveBeenCalledTimes(1);
      const stored = (adapter.set as Mock).mock.calls[0][1];
      expect(JSON.parse(stored)).toBe(5);
    });

    it("should return cached number on cache hit", async () => {
      const { repo, inner, adapter } = createRepo();
      adapter.get.mockResolvedValue("5");

      const result = await repo.count({ name: "Entity A" });

      expect(result).toBe(5);
      expect(inner.count).not.toHaveBeenCalled();
    });

    it("should skip cache when cache:false is set", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.count.mockResolvedValue(3);

      await repo.count({ name: "Entity A" }, { cache: false });

      expect(adapter.get).not.toHaveBeenCalled();
      expect(adapter.set).not.toHaveBeenCalled();
    });
  });

  // ─── Category A: exists() ────────────────────────────────────────────────────

  describe("exists()", () => {
    it("should cache true on cache miss", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.exists.mockResolvedValue(true);
      adapter.get.mockResolvedValue(null);

      const result = await repo.exists({ id: "id-1" });

      expect(result).toBe(true);
      expect(adapter.set).toHaveBeenCalledTimes(1);
    });

    it("should cache false on cache miss (false result also cached)", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.exists.mockResolvedValue(false);
      adapter.get.mockResolvedValue(null);

      const result = await repo.exists({ id: "missing" });

      expect(result).toBe(false);
      expect(adapter.set).toHaveBeenCalledTimes(1);
      const stored = (adapter.set as Mock).mock.calls[0][1];
      expect(JSON.parse(stored)).toBe(false);
    });

    it("should return cached boolean on cache hit", async () => {
      const { repo, inner, adapter } = createRepo();
      adapter.get.mockResolvedValue("true");

      const result = await repo.exists({ id: "id-1" });

      expect(result).toBe(true);
      expect(inner.exists).not.toHaveBeenCalled();
    });
  });

  // ─── Category A: findOneOrSave() ─────────────────────────────────────────────

  describe("findOneOrSave()", () => {
    it("should return existing entity if found via findOne", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.findOne.mockResolvedValue(entityA);
      adapter.get.mockResolvedValue(null);
      (defaultHydrateEntity as Mock).mockReturnValue(entityA);

      const result = await repo.findOneOrSave({ id: "id-1" }, {
        name: "Entity A",
      } as any);

      expect(result).toBe(entityA);
      expect(inner.save).not.toHaveBeenCalled();
    });

    it("should save and return entity when findOne returns null", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.findOne.mockResolvedValue(null);
      adapter.get.mockResolvedValue(null);
      (inner.save as Mock).mockResolvedValue(entityA);

      const result = await repo.findOneOrSave({ id: "id-1" }, {
        name: "Entity A",
      } as any);

      expect(result).toBe(entityA);
      expect(inner.save).toHaveBeenCalledTimes(1);
      // save invalidates cache
      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Category B: Write methods ───────────────────────────────────────────────

  describe("write methods — invalidate on success", () => {
    it("insert() should call inner.insert then invalidate", async () => {
      const { repo, inner, adapter } = createRepo();
      (inner.insert as Mock).mockResolvedValue(entityA);

      const result = await repo.insert(entityA);

      expect(inner.insert).toHaveBeenCalledWith(entityA);
      expect(result).toBe(entityA);
      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
    });

    it("save() should call inner.save then invalidate", async () => {
      const { repo, inner, adapter } = createRepo();
      (inner.save as Mock).mockResolvedValue(entityA);

      const result = await repo.save(entityA);

      expect(inner.save).toHaveBeenCalledWith(entityA);
      expect(result).toBe(entityA);
      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
    });

    it("update() should call inner.update then invalidate", async () => {
      const { repo, inner, adapter } = createRepo();
      (inner.update as Mock).mockResolvedValue(entityA);

      const result = await repo.update(entityA);

      expect(inner.update).toHaveBeenCalledWith(entityA);
      expect(result).toBe(entityA);
      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
    });

    it("clone() should call inner.clone then invalidate", async () => {
      const { repo, inner, adapter } = createRepo();
      (inner.clone as Mock).mockResolvedValue(entityA);

      const result = await repo.clone(entityA);

      expect(inner.clone).toHaveBeenCalledWith(entityA);
      expect(result).toBe(entityA);
      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
    });

    it("destroy() should call inner.destroy then invalidate", async () => {
      const { repo, inner, adapter } = createRepo();

      await repo.destroy(entityA);

      expect(inner.destroy).toHaveBeenCalledWith(entityA);
      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
    });

    it("softDestroy() should call inner.softDestroy then invalidate", async () => {
      const { repo, inner, adapter } = createRepo();

      await repo.softDestroy(entityA);

      expect(inner.softDestroy).toHaveBeenCalledWith(entityA);
      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
    });

    it("upsert() should call inner.upsert then invalidate", async () => {
      const { repo, inner, adapter } = createRepo();
      (inner.upsert as Mock).mockResolvedValue(entityA);

      const result = await repo.upsert(entityA);

      expect(inner.upsert).toHaveBeenCalledWith(entityA, undefined);
      expect(result).toBe(entityA);
      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
    });

    it("delete() should call inner.delete then invalidate", async () => {
      const { repo, inner, adapter } = createRepo();

      await repo.delete({ id: "id-1" });

      expect(inner.delete).toHaveBeenCalledWith({ id: "id-1" }, undefined);
      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
    });

    it("softDelete() should call inner.softDelete then invalidate", async () => {
      const { repo, inner, adapter } = createRepo();

      await repo.softDelete({ id: "id-1" });

      expect(inner.softDelete).toHaveBeenCalledWith({ id: "id-1" }, undefined);
      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
    });

    it("restore() should call inner.restore then invalidate", async () => {
      const { repo, inner, adapter } = createRepo();

      await repo.restore({ id: "id-1" });

      expect(inner.restore).toHaveBeenCalledWith({ id: "id-1" }, undefined);
      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
    });

    it("updateMany() should call inner.updateMany then invalidate", async () => {
      const { repo, inner, adapter } = createRepo();

      await repo.updateMany({ name: "old" }, { name: "new" });

      expect(inner.updateMany).toHaveBeenCalledWith({ name: "old" }, { name: "new" });
      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
    });

    it("increment() should call inner.increment then invalidate", async () => {
      const { repo, inner, adapter } = createRepo();

      await repo.increment({ id: "id-1" }, "version", 1);

      expect(inner.increment).toHaveBeenCalledWith({ id: "id-1" }, "version", 1);
      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
    });

    it("decrement() should call inner.decrement then invalidate", async () => {
      const { repo, inner, adapter } = createRepo();

      await repo.decrement({ id: "id-1" }, "version", 1);

      expect(inner.decrement).toHaveBeenCalledWith({ id: "id-1" }, "version", 1);
      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
    });

    it("deleteExpired() should call inner.deleteExpired then invalidate", async () => {
      const { repo, inner, adapter } = createRepo();

      await repo.deleteExpired();

      expect(inner.deleteExpired).toHaveBeenCalledTimes(1);
      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
    });

    it("clear() should call inner.clear then invalidate", async () => {
      const { repo, inner, adapter } = createRepo();

      await repo.clear();

      expect(inner.clear).toHaveBeenCalledTimes(1);
      expect(adapter.delByPrefix).toHaveBeenCalledTimes(1);
    });
  });

  describe("write methods — no invalidation on inner failure", () => {
    it("should NOT call invalidate when inner.save throws", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.save.mockRejectedValue(new Error("DB error"));

      await expect(repo.save(entityA)).rejects.toThrow("DB error");

      expect(adapter.delByPrefix).not.toHaveBeenCalled();
    });

    it("should NOT call invalidate when inner.destroy throws", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.destroy.mockRejectedValue(new Error("DB error"));

      await expect(repo.destroy(entityA)).rejects.toThrow("DB error");

      expect(adapter.delByPrefix).not.toHaveBeenCalled();
    });

    it("should NOT call invalidate when inner.delete throws", async () => {
      const { repo, inner, adapter } = createRepo();
      inner.delete.mockRejectedValue(new Error("DB error"));

      await expect(repo.delete({ id: "id-1" })).rejects.toThrow("DB error");

      expect(adapter.delByPrefix).not.toHaveBeenCalled();
    });
  });

  // ─── Invalidation resilience ─────────────────────────────────────────────────

  describe("cache invalidation failure resilience", () => {
    it("should not throw when adapter.delByPrefix throws during invalidation", async () => {
      const { repo, inner, adapter } = createRepo();
      (inner.save as Mock).mockResolvedValue(entityA);
      adapter.delByPrefix.mockRejectedValue(new Error("adapter offline"));

      // Should succeed — invalidation errors are swallowed
      await expect(repo.save(entityA)).resolves.toBe(entityA);
    });
  });

  // ─── Serialization ───────────────────────────────────────────────────────────

  describe("serialization", () => {
    it("should NOT apply field.transform.to() when serializing — stores entity-side values directly", async () => {
      const transformTo = vi.fn().mockReturnValue("transformed");
      const metadata = makeBaseMetadata({
        fields: [
          {
            key: "name",
            decorator: "Field",
            arrayType: null,
            collation: null,
            comment: null,
            computed: null,
            enum: null,
            default: null,
            hideOn: [],
            max: null,
            min: null,
            name: "name",
            nullable: false,

            precision: null,
            readonly: false,
            scale: null,
            schema: null,
            transform: { to: transformTo, from: vi.fn() },
            type: "string",
          },
        ] as any,
      });
      const { repo, inner, adapter } = createRepo({ metadata });
      inner.find.mockResolvedValue([entityA]);
      adapter.get.mockResolvedValue(null);

      await repo.find({ name: "Entity A" });

      expect(transformTo).not.toHaveBeenCalled();
      // Verify the raw entity value is stored, not a transformed one
      const setCall = (adapter.set as Mock).mock.calls[0];
      const serialized = JSON.parse(setCall[1]);
      expect(serialized[0].name).toBe("Entity A");
    });

    it("should run AfterLoad hooks on deserialized entities from cache", async () => {
      const { repo, inner, adapter } = createRepo();
      const serialized = JSON.stringify([{ id: "id-1", name: "Entity A" }]);
      adapter.get.mockResolvedValue(serialized);
      (defaultHydrateEntity as Mock).mockReturnValue(entityA);

      await repo.find({ name: "Entity A" });

      expect(runHooksAsync).toHaveBeenCalledWith(
        "AfterLoad",
        expect.any(Array),
        entityA,
        undefined,
      );
    });

    it("should handle BigInt values through JSON round-trip", async () => {
      // Verify the cache key can be built with BigInt criteria (no crash)
      const { repo, inner, adapter } = createRepo();
      inner.find.mockResolvedValue([]);
      adapter.get.mockResolvedValue(null);

      await expect(repo.find({ version: BigInt(42) } as any)).resolves.toEqual([]);
    });

    it("should strip hidden fields on cache-hit deserialization for find() (multiple scope)", async () => {
      const metadata = makeBaseMetadata({
        fields: [
          {
            key: "id",
            decorator: "Field",
            arrayType: null,
            collation: null,
            comment: null,
            computed: null,
            enum: null,
            default: null,
            hideOn: [],
            max: null,
            min: null,
            name: "id",
            nullable: false,

            precision: null,
            readonly: true,
            scale: null,
            schema: null,
            transform: null,
            type: "uuid",
          },
          {
            key: "secret",
            decorator: "Field",
            arrayType: null,
            collation: null,
            comment: null,
            computed: null,
            enum: null,
            default: null,
            hideOn: ["multiple"],
            max: null,
            min: null,
            name: "secret",
            nullable: false,

            precision: null,
            readonly: false,
            scale: null,
            schema: null,
            transform: null,
            type: "string",
          },
        ] as any,
      });
      const { repo, adapter } = createRepo({ metadata });
      const serialized = JSON.stringify([{ id: "id-1", secret: "should-be-hidden" }]);
      adapter.get.mockResolvedValue(serialized);

      const hydratedEntity = Object.assign(new TestEntity(), {
        id: "id-1",
        secret: "should-be-hidden",
      });
      (defaultHydrateEntity as Mock).mockReturnValue(hydratedEntity);

      const result = await repo.find({ id: "id-1" } as any);

      expect(result).toHaveLength(1);
      expect((result[0] as any).secret).toBeUndefined();
      expect((result[0] as any).id).toBe("id-1");
    });

    it("should strip hidden fields scoped to 'single' on findOne() cache-hit", async () => {
      const metadata = makeBaseMetadata({
        fields: [
          {
            key: "id",
            decorator: "Field",
            arrayType: null,
            collation: null,
            comment: null,
            computed: null,
            enum: null,
            default: null,
            hideOn: [],
            max: null,
            min: null,
            name: "id",
            nullable: false,

            precision: null,
            readonly: true,
            scale: null,
            schema: null,
            transform: null,
            type: "uuid",
          },
          {
            key: "password",
            decorator: "Field",
            arrayType: null,
            collation: null,
            comment: null,
            computed: null,
            enum: null,
            default: null,
            hideOn: ["single"],
            max: null,
            min: null,
            name: "password",
            nullable: false,

            precision: null,
            readonly: false,
            scale: null,
            schema: null,
            transform: null,
            type: "string",
          },
        ] as any,
      });
      const { repo, adapter } = createRepo({ metadata });
      const serialized = JSON.stringify([{ id: "id-1", password: "secret-hash" }]);
      adapter.get.mockResolvedValue(serialized);

      const hydratedEntity = Object.assign(new TestEntity(), {
        id: "id-1",
        password: "secret-hash",
      });
      (defaultHydrateEntity as Mock).mockReturnValue(hydratedEntity);

      const result = await repo.findOne({ id: "id-1" } as any);

      expect(result).not.toBeNull();
      expect((result as any).password).toBeUndefined();
      expect((result as any).id).toBe("id-1");
    });

    it("should include FK join-key columns from owning non-M2M relations in serialized output", async () => {
      const metadata = makeBaseMetadata({
        relations: [
          {
            key: "parent",
            type: "ManyToOne",
            foreignConstructor: () => TestEntity,
            foreignKey: "id",
            findKeys: null,
            joinKeys: { parentId: "id" },
            joinTable: null,
            orderBy: null,
            options: {
              deferrable: false,
              initiallyDeferred: false,
              loading: { single: "none", multiple: "none" },
              nullable: true,
              onDestroy: "ignore",
              onInsert: "ignore",
              onOrphan: "ignore",
              onSoftDestroy: "ignore",
              onUpdate: "ignore",
              strategy: null,
            },
          },
        ] as any,
      });
      const { repo, inner, adapter } = createRepo({ metadata });
      const entityWithFk = Object.assign(new TestEntity(), {
        ...entityA,
        parentId: "parent-id-1",
      });
      inner.find.mockResolvedValue([entityWithFk]);
      adapter.get.mockResolvedValue(null);

      await repo.find({});

      const setCall = (adapter.set as Mock).mock.calls[0];
      const serialized = JSON.parse(setCall[1]);
      expect(serialized[0].parentId).toBe("parent-id-1");
    });

    it("should NOT include FK join-key columns from ManyToMany relations", async () => {
      const metadata = makeBaseMetadata({
        relations: [
          {
            key: "tags",
            type: "ManyToMany",
            foreignConstructor: () => TestEntity,
            foreignKey: "id",
            findKeys: null,
            joinKeys: { tagId: "id" },
            joinTable: "entity_tags",
            orderBy: null,
            options: {
              deferrable: false,
              initiallyDeferred: false,
              loading: { single: "none", multiple: "none" },
              nullable: false,
              onDestroy: "ignore",
              onInsert: "ignore",
              onOrphan: "ignore",
              onSoftDestroy: "ignore",
              onUpdate: "ignore",
              strategy: null,
            },
          },
        ] as any,
      });
      const { repo, inner, adapter } = createRepo({ metadata });
      inner.find.mockResolvedValue([entityA]);
      adapter.get.mockResolvedValue(null);

      await repo.find({});

      const setCall = (adapter.set as Mock).mock.calls[0];
      const serialized = JSON.parse(setCall[1]);
      expect("tagId" in serialized[0]).toBe(false);
    });
  });

  // ─── Namespace in cache key ───────────────────────────────────────────────────

  describe("namespace in cache key", () => {
    it("should include namespace in the cache key when namespace is set", async () => {
      const { repo, inner, adapter } = createRepo({ namespace: "myapp" });
      inner.find.mockResolvedValue([]);
      adapter.get.mockResolvedValue(null);

      await repo.find({});

      const getKey = (adapter.get as Mock).mock.calls[0][0] as string;
      expect(getKey).toContain("myapp:");
    });

    it("should not include namespace separator when namespace is null", async () => {
      const { repo, inner, adapter } = createRepo({ namespace: null });
      inner.find.mockResolvedValue([]);
      adapter.get.mockResolvedValue(null);

      await repo.find({});

      const getKey = (adapter.get as Mock).mock.calls[0][0] as string;
      expect(getKey).not.toContain("null:");
      expect(getKey).toMatch(/^cache:TestEntity:/);
    });

    it("should use entity-scoped prefix for invalidation", async () => {
      const { repo, inner, adapter } = createRepo({ namespace: "myapp" });
      (inner.save as Mock).mockResolvedValue(entityA);

      await repo.save(entityA);

      const prefix = (adapter.delByPrefix as Mock).mock.calls[0][0] as string;
      expect(prefix).toBe("myapp:cache:TestEntity:");
    });
  });
});
