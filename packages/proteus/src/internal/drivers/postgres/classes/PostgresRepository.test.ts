import type { ILogger } from "@lindorm/logger";
import { makeField } from "../../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import type { IRepositoryExecutor } from "../../../interfaces/RepositoryExecutor.js";
import type { PostgresQueryClient } from "../types/postgres-query-client.js";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError.js";
import { DuplicateKeyError } from "../../../errors/DuplicateKeyError.js";
import { PostgresRepository } from "./PostgresRepository.js";
import type { IEntity } from "../../../../interfaces/index.js";
import type { Constructor } from "@lindorm/types";
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type Mock,
  type Mocked,
  type MockedClass,
} from "vitest";

// ─── Module Mocks ────────────────────────────────────────────────────────────

vi.mock("../../../entity/classes/EntityManager.js", async () => ({
  EntityManager: vi.fn(),
}));

vi.mock("../../../entity/metadata/get-entity-metadata.js", () => ({
  getEntityMetadata: vi.fn(),
}));

const mockSaveOwning = vi.fn();
const mockSaveInverse = vi.fn();
const mockDestroy = vi.fn();
vi.mock("../../../utils/repository/RelationPersister.js", () => ({
  RelationPersister: vi.fn(function () {
    return {
      saveOwning: mockSaveOwning,
      saveInverse: mockSaveInverse,
      destroy: mockDestroy,
    };
  }),
}));

vi.mock("../../../utils/repository/build-pk-predicate.js", () => ({
  buildPrimaryKeyPredicate: vi.fn(),
}));

vi.mock("../../../utils/repository/repository-guards.js", () => ({
  guardAppendOnly: vi.fn(),
  guardDeleteDateField: vi.fn(),
  guardExpiryDateField: vi.fn(),
  guardVersionFields: vi.fn(),
  guardUpsertBlocked: vi.fn(),
  validateRelationNames: vi.fn(),
}));

vi.mock("../utils/repository/wrap-pg-error.js", () => ({
  wrapPgError: vi.fn(),
}));

vi.mock("../../../errors/DuplicateKeyError.js", async () => {
  const { ProteusRepositoryError } = await vi.importActual<
    typeof import("../../../../errors/ProteusRepositoryError")
  >("../../../../errors/ProteusRepositoryError");
  class DuplicateKeyError extends ProteusRepositoryError {}
  return { DuplicateKeyError };
});

vi.mock("../utils/query/compile-upsert.js", async () => ({
  compileUpsert: vi.fn(),
}));

vi.mock("../utils/query/compile-insert.js", () => ({
  compileInsertBulk: vi.fn(),
}));

vi.mock("../utils/query/compile-aggregate.js", () => ({
  compileAggregate: vi.fn(),
}));

vi.mock("../utils/query/compile-query.js", () => ({
  compileQuery: vi.fn(),
}));

vi.mock("../utils/query/hydrate-returning.js", () => ({
  hydrateReturning: vi.fn(),
}));

vi.mock("./PostgresCursor.js", () => ({
  PostgresCursor: vi.fn(),
}));

// ─── Import mocks after vi.mock ────────────────────────────────────────────

import { EntityManager } from "../../../entity/classes/EntityManager.js";
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata.js";
import { RelationPersister } from "../../../utils/repository/RelationPersister.js";
import { buildPrimaryKeyPredicate } from "../../../utils/repository/build-pk-predicate.js";
import {
  guardDeleteDateField,
  guardExpiryDateField,
  guardVersionFields,
  guardUpsertBlocked,
  validateRelationNames as _validateRelationNames,
} from "../../../utils/repository/repository-guards.js";
import { wrapPgError } from "../utils/repository/wrap-pg-error.js";
import { compileUpsert } from "../utils/query/compile-upsert.js";
import { compileInsertBulk } from "../utils/query/compile-insert.js";
import { compileAggregate } from "../utils/query/compile-aggregate.js";
import { compileQuery } from "../utils/query/compile-query.js";
import { hydrateReturning } from "../utils/query/hydrate-returning.js";
import { PostgresCursor } from "./PostgresCursor.js";

const validateRelationNames = _validateRelationNames as unknown as Mock;

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Simple entity fixture (no decorators needed — EntityManager and getEntityMetadata are mocked)
class TestEntity implements IEntity {
  id!: string;
  version!: number;
  createdAt!: Date;
  updatedAt!: Date;
  name!: string;
}

const mockMetadata = {
  target: TestEntity,
  checks: [],
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "TestEntity",
    namespace: null,
  },
  extras: [],
  fields: [
    makeField("id", { decorator: "Field", readonly: true }),
    makeField("version", { decorator: "Version", type: "integer" }),
    makeField("createdAt", { decorator: "CreateDate", type: "timestamp" }),
    makeField("updatedAt", { decorator: "UpdateDate", type: "timestamp" }),
    makeField("name", { type: "string" }),
  ],
  generated: [],
  hooks: [],
  indexes: [],
  primaryKeys: ["id"],
  relations: [],
  embeddedLists: [],
  schemas: [],
  uniques: [],
  versionKeys: [],
} as unknown as EntityMetadata;

const mockMetadataWithDeleteDate = {
  ...mockMetadata,
  fields: [
    ...mockMetadata.fields,
    makeField("deletedAt", {
      decorator: "DeleteDate",
      type: "timestamp",
      nullable: true,
    }),
  ],
};

const mockMetadataWithExpiryDate = {
  ...mockMetadata,
  fields: [
    ...mockMetadata.fields,
    makeField("expiresAt", {
      decorator: "ExpiryDate",
      type: "timestamp",
      nullable: true,
    }),
  ],
};

const mockMetadataWithVersionDates = {
  ...mockMetadata,
  fields: [
    ...mockMetadata.fields,
    makeField("startAt", { decorator: "VersionStartDate", type: "timestamp" }),
    makeField("endAt", {
      decorator: "VersionEndDate",
      type: "timestamp",
      nullable: true,
    }),
  ],
  versionKeys: ["versionId"],
};

const mockMetadataWithRelations = {
  ...mockMetadata,
  relations: [
    {
      key: "items",
      type: "OneToMany",
      foreignConstructor: () => TestEntity,
      foreignKey: "parentId",
      findKeys: { parentId: "id" },
      joinKeys: null,
      joinTable: null,
      options: {
        deferrable: false,
        initiallyDeferred: false,
        loading: { single: "lazy", multiple: "lazy" },
        nullable: false,
        onDestroy: "cascade",
        onInsert: "cascade",
        onOrphan: "ignore",
        onSoftDestroy: "ignore",
        onUpdate: "cascade",
        strategy: null,
      },
    },
  ],
} as unknown as EntityMetadata;

const createMockLogger = (): ILogger =>
  ({
    child: vi.fn().mockReturnThis(),
    silly: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }) as unknown as ILogger;

const createMockExecutor = (): Mocked<IRepositoryExecutor<TestEntity>> => ({
  executeInsert: vi.fn(),
  executeUpdate: vi.fn(),
  executeDelete: vi.fn(),
  executeSoftDelete: vi.fn(),
  executeRestore: vi.fn(),
  executeDeleteExpired: vi.fn(),
  executeTtl: vi.fn(),
  executeFind: vi.fn(),
  executeCount: vi.fn(),
  executeExists: vi.fn(),
  executeIncrement: vi.fn(),
  executeDecrement: vi.fn(),
  executeInsertBulk: vi.fn(),
  executeUpdateMany: vi.fn(),
});

const createMockClient = (): PostgresQueryClient =>
  ({
    query: vi.fn(),
  }) as unknown as PostgresQueryClient;

const createMockEntityManager = (overrides: Record<string, any> = {}): any => ({
  target: TestEntity,
  updateStrategy: "update",
  create: vi.fn(),
  copy: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  clone: vi.fn(),
  validate: vi.fn(),
  beforeInsert: vi.fn(),
  afterInsert: vi.fn(),
  beforeSave: vi.fn(),
  afterSave: vi.fn(),
  beforeUpdate: vi.fn(),
  afterUpdate: vi.fn(),
  beforeDestroy: vi.fn(),
  afterDestroy: vi.fn(),
  beforeSoftDestroy: vi.fn(),
  afterSoftDestroy: vi.fn(),
  afterLoad: vi.fn(),
  getSaveStrategy: vi.fn(),
  versionUpdate: vi.fn(),
  versionCopy: vi.fn(),
  verifyReadonly: vi.fn(),
  ...overrides,
});

// Entity instance used in most tests
const entityA: TestEntity = Object.assign(new TestEntity(), {
  id: "entity-id-1",
  version: 1,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  name: "Entity A",
});

const entityB: TestEntity = Object.assign(new TestEntity(), {
  id: "entity-id-2",
  version: 1,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  name: "Entity B",
});

// ─── Factory ──────────────────────────────────────────────────────────────────

const createRepository = (
  overrides: {
    metadata?: EntityMetadata;
    executorOverrides?: Record<string, any>;
    entityManagerOverrides?: Record<string, any>;
    withImplicitTransaction?: Mock;
  } = {},
) => {
  const meta = overrides.metadata ?? mockMetadata;
  const executor = createMockExecutor();
  const client = createMockClient();
  const logger = createMockLogger();
  const mockEM = createMockEntityManager(overrides.entityManagerOverrides);

  // Apply any executor overrides
  if (overrides.executorOverrides) {
    Object.assign(executor, overrides.executorOverrides);
  }

  // Wire up mocks
  (getEntityMetadata as Mock).mockReturnValue(meta);
  const MockEntityManager = EntityManager as MockedClass<
    typeof EntityManager<TestEntity>
  >;
  MockEntityManager.mockImplementation(function () {
    return mockEM;
  });

  const withImplicitTransaction: Mock =
    overrides.withImplicitTransaction ??
    vi
      .fn()
      .mockImplementation(async (fn: any) => fn({ client, executor, repositoryFactory }));

  const repositoryFactory = vi.fn();
  const queryBuilderFactory = vi.fn().mockReturnValue({ build: vi.fn() });

  const repo = new PostgresRepository<TestEntity>({
    target: TestEntity,
    executor,
    queryBuilderFactory,
    client,
    namespace: null,
    logger,
    repositoryFactory,
    withImplicitTransaction,
  });

  return {
    repo,
    executor,
    client,
    logger,
    mockEM,
    withImplicitTransaction,
    repositoryFactory,
  };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PostgresRepository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-wire RelationPersister constructor after resetAllMocks
    (RelationPersister as unknown as Mock).mockImplementation(function () {
      return {
        saveOwning: mockSaveOwning,
        saveInverse: mockSaveInverse,
        destroy: mockDestroy,
      };
    });
    // Default: wrapPgError re-throws as ProteusRepositoryError
    (wrapPgError as unknown as Mock).mockImplementation(
      (error: unknown, message: string) => {
        throw new ProteusRepositoryError(message);
      },
    );
    // Default: buildPrimaryKeyPredicate returns { id: entity.id }
    (buildPrimaryKeyPredicate as Mock).mockImplementation((entity: any) => ({
      id: entity.id,
    }));
    // Default: relation helpers resolve immediately
    mockSaveOwning.mockResolvedValue(undefined);
    mockSaveInverse.mockResolvedValue(undefined);
    mockDestroy.mockResolvedValue(undefined);
  });

  // ─── Entity Handlers ────────────────────────────────────────────────────────

  describe("create", () => {
    test("delegates to EntityManager.create and returns result", () => {
      const { repo, mockEM } = createRepository();
      mockEM.create.mockReturnValue(entityA);

      const result = repo.create({ name: "Entity A" });

      expect(mockEM.create).toHaveBeenCalledWith({ name: "Entity A" });
      expect(result).toBe(entityA);
    });

    test("calls create with no arguments when called with no options", () => {
      const { repo, mockEM } = createRepository();
      mockEM.create.mockReturnValue(entityA);

      repo.create();

      expect(mockEM.create).toHaveBeenCalledWith(undefined);
    });
  });

  describe("copy", () => {
    test("delegates to EntityManager.copy and returns result", () => {
      const { repo, mockEM } = createRepository();
      const copied = { ...entityA, id: "copy-id" } as TestEntity;
      mockEM.copy.mockReturnValue(copied);

      const result = repo.copy(entityA);

      expect(mockEM.copy).toHaveBeenCalledWith(entityA);
      expect(result).toBe(copied);
    });
  });

  describe("validate", () => {
    test("delegates to EntityManager.validate", () => {
      const { repo, mockEM } = createRepository();

      repo.validate(entityA);

      expect(mockEM.validate).toHaveBeenCalledWith(entityA);
    });
  });

  // ─── Queries ────────────────────────────────────────────────────────────────

  describe("count", () => {
    test("delegates to executor.executeCount with criteria and options", async () => {
      const { repo, executor } = createRepository();
      executor.executeCount.mockResolvedValue(5);

      const result = await repo.count({ name: "A" } as any, { limit: 10 });

      expect(executor.executeCount).toHaveBeenCalledWith({ name: "A" }, { limit: 10 });
      expect(result).toBe(5);
    });

    test("passes empty objects when no criteria or options provided", async () => {
      const { repo, executor } = createRepository();
      executor.executeCount.mockResolvedValue(0);

      await repo.count();

      expect(executor.executeCount).toHaveBeenCalledWith({}, {});
    });
  });

  describe("exists", () => {
    test("calls executeExists when no options provided", async () => {
      const { repo, executor } = createRepository();
      executor.executeExists.mockResolvedValue(true);

      const result = await repo.exists({ id: "x" } as any);

      expect(executor.executeExists).toHaveBeenCalledWith({ id: "x" });
      expect(executor.executeCount).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    test("calls executeExists when options is empty object", async () => {
      const { repo, executor } = createRepository();
      executor.executeExists.mockResolvedValue(false);

      const result = await repo.exists({ id: "x" } as any, {});

      expect(executor.executeExists).toHaveBeenCalledWith({ id: "x" });
      expect(result).toBe(false);
    });

    test("uses executeCount when options has keys (e.g. withDeleted)", async () => {
      const { repo, executor } = createRepository();
      executor.executeCount.mockResolvedValue(1);

      const result = await repo.exists({ id: "x" } as any, { withDeleted: true });

      expect(executor.executeCount).toHaveBeenCalledWith(
        { id: "x" },
        { withDeleted: true },
      );
      expect(executor.executeExists).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    test("returns false when executeCount returns 0", async () => {
      const { repo, executor } = createRepository();
      executor.executeCount.mockResolvedValue(0);

      const result = await repo.exists({ id: "x" } as any, { withDeleted: true });

      expect(result).toBe(false);
    });
  });

  describe("find", () => {
    test("delegates to executor.executeFind and calls afterLoad on each entity", async () => {
      const { repo, executor, mockEM } = createRepository();
      executor.executeFind.mockResolvedValue([entityA, entityB]);

      const result = await repo.find({ name: "x" } as any, { limit: 10 });

      expect(executor.executeFind).toHaveBeenCalledWith(
        { name: "x" },
        { limit: 10 },
        "multiple",
      );
      expect(mockEM.afterLoad).toHaveBeenCalledWith(entityA);
      expect(mockEM.afterLoad).toHaveBeenCalledWith(entityB);
      expect(result).toEqual([entityA, entityB]);
    });

    test("passes empty criteria and options when none provided", async () => {
      const { repo, executor } = createRepository();
      executor.executeFind.mockResolvedValue([]);

      await repo.find();

      expect(executor.executeFind).toHaveBeenCalledWith({}, {}, "multiple");
    });

    test("calls validateRelationNames when relations option is provided", async () => {
      const { repo, executor } = createRepository();
      executor.executeFind.mockResolvedValue([]);

      await repo.find({} as any, { relations: ["tags"] as any });

      expect(validateRelationNames).toHaveBeenCalledWith(mockMetadata, ["tags"]);
    });

    test("propagates validateRelationNames error", async () => {
      validateRelationNames.mockImplementation(() => {
        throw new ProteusRepositoryError('Unknown relation "unknown"');
      });
      const { repo } = createRepository();

      await expect(
        repo.find({} as any, { relations: ["unknown"] as any }),
      ).rejects.toThrow(ProteusRepositoryError);
    });
  });

  describe("findOne", () => {
    test("returns first entity from find with limit: 1", async () => {
      const { repo, executor, mockEM } = createRepository();
      executor.executeFind.mockResolvedValue([entityA]);

      const result = await repo.findOne({ id: "entity-id-1" } as any);

      expect(executor.executeFind).toHaveBeenCalledWith(
        { id: "entity-id-1" },
        { limit: 1 },
        "single",
      );
      expect(mockEM.afterLoad).toHaveBeenCalledWith(entityA);
      expect(result).toBe(entityA);
    });

    test("returns null when no entity found", async () => {
      const { repo, executor } = createRepository();
      executor.executeFind.mockResolvedValue([]);

      const result = await repo.findOne({ id: "missing" } as any);

      expect(result).toBeNull();
    });

    test("merges provided options with limit: 1", async () => {
      const { repo, executor } = createRepository();
      executor.executeFind.mockResolvedValue([entityA]);

      await repo.findOne({ id: "x" } as any, { withDeleted: true });

      expect(executor.executeFind).toHaveBeenCalledWith(
        { id: "x" },
        { withDeleted: true, limit: 1 },
        "single",
      );
    });
  });

  describe("findOneOrFail", () => {
    test("returns entity when found", async () => {
      const { repo, executor, mockEM } = createRepository();
      executor.executeFind.mockResolvedValue([entityA]);

      const result = await repo.findOneOrFail({ id: "entity-id-1" } as any);

      expect(result).toBe(entityA);
    });

    test("throws ProteusRepositoryError when entity not found", async () => {
      const { repo, executor } = createRepository();
      executor.executeFind.mockResolvedValue([]);

      await expect(repo.findOneOrFail({ id: "missing" } as any)).rejects.toThrow(
        ProteusRepositoryError,
      );
    });

    test("error message includes entity name", async () => {
      const { repo, executor } = createRepository();
      executor.executeFind.mockResolvedValue([]);

      await expect(repo.findOneOrFail({ id: "missing" } as any)).rejects.toThrow(
        "TestEntity",
      );
    });
  });

  describe("findAndCount", () => {
    test("returns tuple of entities and count", async () => {
      const { repo, executor } = createRepository();
      executor.executeFind.mockResolvedValue([entityA, entityB]);
      executor.executeCount.mockResolvedValue(2);

      const result = await repo.findAndCount({} as any, { limit: 10 });

      expect(result[0]).toEqual([entityA, entityB]);
      expect(result[1]).toBe(2);
    });

    test("strips limit and offset from count options", async () => {
      const { repo, executor } = createRepository();
      executor.executeFind.mockResolvedValue([entityA]);
      executor.executeCount.mockResolvedValue(100);

      await repo.findAndCount(
        {} as any,
        {
          limit: 10,
          offset: 20,
          withDeleted: true,
        } as any,
      );

      // Count call should NOT have pagination keys
      const countCall = executor.executeCount.mock.calls[0][1];
      expect(countCall).not.toHaveProperty("limit");
      expect(countCall).not.toHaveProperty("offset");
      // Non-pagination options should be preserved
      expect(countCall).toHaveProperty("withDeleted", true);
    });

    test("runs find and count in parallel", async () => {
      const { repo, executor } = createRepository();
      const order: string[] = [];

      executor.executeFind.mockImplementation(async () => {
        order.push("find");
        return [entityA];
      });
      executor.executeCount.mockImplementation(async () => {
        order.push("count");
        return 1;
      });

      await repo.findAndCount();

      // Both ran (order doesn't matter for parallel)
      expect(order).toContain("find");
      expect(order).toContain("count");
    });

    test("handles no options provided", async () => {
      const { repo, executor } = createRepository();
      executor.executeFind.mockResolvedValue([]);
      executor.executeCount.mockResolvedValue(0);

      const result = await repo.findAndCount();

      expect(result).toEqual([[], 0]);
      // When no options, countOptions is undefined → count() passes {} as default
      expect(executor.executeCount).toHaveBeenCalledWith({}, {});
    });
  });

  // ─── Insert ────────────────────────────────────────────────────────────────

  describe("insert (single)", () => {
    test("fast path: no relations — skips transaction and relation helpers", async () => {
      const { repo, executor, mockEM, withImplicitTransaction } = createRepository();
      const prepared = { ...entityA, id: "prepared-id" } as TestEntity;
      const hydrated = { ...entityA, id: "hydrated-id" } as TestEntity;

      mockEM.create.mockReturnValue(entityA);
      mockEM.insert.mockResolvedValue(prepared);
      executor.executeInsert.mockResolvedValue(hydrated);

      const result = await repo.insert({ name: "Entity A" } as any);

      expect(mockEM.insert).toHaveBeenCalledWith(entityA);
      expect(mockEM.validate).toHaveBeenCalledWith(prepared);
      expect(withImplicitTransaction).not.toHaveBeenCalled();
      expect(mockSaveOwning).not.toHaveBeenCalled();
      expect(mockSaveInverse).not.toHaveBeenCalled();
      expect(mockEM.beforeInsert).toHaveBeenCalledWith(prepared);
      expect(executor.executeInsert).toHaveBeenCalledWith(prepared);
      expect(mockEM.afterInsert).toHaveBeenCalledWith(hydrated);
      expect(result).toBe(hydrated);
    });

    test("transaction path: with relations — calls saveOwning/saveInverse within transaction", async () => {
      const { repo, executor, mockEM } = createRepository({
        metadata: mockMetadataWithRelations,
      });
      const prepared = { ...entityA, id: "prepared-id" } as TestEntity;
      const hydrated = { ...entityA, id: "hydrated-id" } as TestEntity;

      mockEM.create.mockReturnValue(entityA);
      mockEM.insert.mockResolvedValue(prepared);
      executor.executeInsert.mockResolvedValue(hydrated);

      const result = await repo.insert({ name: "Entity A" } as any);

      expect(mockEM.insert).toHaveBeenCalledWith(entityA);
      expect(mockEM.validate).toHaveBeenCalledWith(prepared);
      expect(mockSaveOwning).toHaveBeenCalledWith(prepared, "insert");
      expect(mockEM.beforeInsert).toHaveBeenCalledWith(prepared);
      expect(executor.executeInsert).toHaveBeenCalledWith(prepared);
      expect(mockEM.afterInsert).toHaveBeenCalledWith(hydrated);
      expect(mockSaveInverse).toHaveBeenCalledWith(hydrated, "insert");
      expect(result).toBe(hydrated);
    });

    test("uses existing entity instance without calling create", async () => {
      const { repo, executor, mockEM } = createRepository();
      const prepared = { ...entityA } as TestEntity;
      const hydrated = { ...entityA } as TestEntity;

      mockEM.insert.mockResolvedValue(prepared);
      executor.executeInsert.mockResolvedValue(hydrated);

      // Pass an actual TestEntity instance — should skip create()
      await repo.insert(entityA);

      expect(mockEM.create).not.toHaveBeenCalled();
      expect(mockEM.insert).toHaveBeenCalledWith(entityA);
    });

    test("saveOwning is called BEFORE executeInsert", async () => {
      const { repo, executor, mockEM } = createRepository({
        metadata: mockMetadataWithRelations,
      });
      const order: string[] = [];

      mockEM.insert.mockResolvedValue(entityA);
      mockSaveOwning.mockImplementation(async () => {
        order.push("saveOwning");
      });
      executor.executeInsert.mockImplementation(async () => {
        order.push("executeInsert");
        return entityA;
      });

      await repo.insert(entityA);

      expect(order.indexOf("saveOwning")).toBeLessThan(order.indexOf("executeInsert"));
    });

    test("saveInverse is called AFTER executeInsert", async () => {
      const { repo, executor, mockEM } = createRepository({
        metadata: mockMetadataWithRelations,
      });
      const order: string[] = [];

      mockEM.insert.mockResolvedValue(entityA);
      executor.executeInsert.mockImplementation(async () => {
        order.push("executeInsert");
        return entityA;
      });
      mockSaveInverse.mockImplementation(async () => {
        order.push("saveInverse");
      });

      await repo.insert(entityA);

      expect(order.indexOf("executeInsert")).toBeLessThan(order.indexOf("saveInverse"));
    });

    test("calls wrapPgError when executeInsert throws non-ProteusError", async () => {
      const { repo, executor, mockEM } = createRepository();

      mockEM.insert.mockResolvedValue(entityA);
      executor.executeInsert.mockRejectedValue(new Error("pg error"));

      await expect(repo.insert(entityA)).rejects.toThrow(ProteusRepositoryError);
      expect(wrapPgError).toHaveBeenCalled();
    });

    test("wrapPgError receives entity name in message", async () => {
      const { repo, executor, mockEM } = createRepository();
      const dbError = new Error("db failure");

      mockEM.insert.mockResolvedValue(entityA);
      executor.executeInsert.mockRejectedValue(dbError);

      try {
        await repo.insert(entityA);
      } catch (_) {
        /* expected */
      }

      const [err, msg] = (wrapPgError as unknown as Mock).mock.calls[0];
      expect(err).toBe(dbError);
      expect(msg).toContain("TestEntity");
    });
  });

  describe("insert (array)", () => {
    test("uses bulk insert for array input", async () => {
      const { repo, client, mockEM } = createRepository();

      mockEM.insert.mockResolvedValueOnce(entityA).mockResolvedValueOnce(entityB);
      const compiledSql = {
        text: "INSERT INTO ... VALUES ...",
        params: ["val1", "val2"],
      };
      (compileInsertBulk as Mock).mockReturnValue(compiledSql);
      (client.query as Mock).mockResolvedValue({
        rows: [
          { id: "entity-id-1", name: "Entity A" },
          { id: "entity-id-2", name: "Entity B" },
        ],
        rowCount: 2,
      });
      (hydrateReturning as Mock)
        .mockReturnValueOnce(entityA)
        .mockReturnValueOnce(entityB);

      const result = await repo.insert([entityA, entityB]);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(compileInsertBulk).toHaveBeenCalled();
    });
  });

  // ─── Update ────────────────────────────────────────────────────────────────

  describe("update (standard)", () => {
    test("fast path: no relations — skips transaction and relation helpers", async () => {
      const { repo, executor, mockEM, withImplicitTransaction } = createRepository();
      const prepared = { ...entityA, version: 2 } as TestEntity;
      const hydrated = { ...entityA, version: 2 } as TestEntity;

      mockEM.updateStrategy = "update";
      mockEM.update.mockReturnValue(prepared);
      executor.executeUpdate.mockResolvedValue(hydrated);

      const result = await repo.update(entityA);

      expect(mockEM.update).toHaveBeenCalledWith(entityA);
      expect(mockEM.validate).toHaveBeenCalledWith(prepared);
      expect(withImplicitTransaction).not.toHaveBeenCalled();
      expect(mockSaveOwning).not.toHaveBeenCalled();
      expect(mockSaveInverse).not.toHaveBeenCalled();
      expect(mockEM.beforeUpdate).toHaveBeenCalledWith(prepared);
      expect(executor.executeUpdate).toHaveBeenCalledWith(prepared);
      expect(mockEM.afterUpdate).toHaveBeenCalledWith(hydrated);
      expect(result).toBe(hydrated);
    });

    test("transaction path: with relations — calls saveOwning/saveInverse within transaction", async () => {
      const { repo, executor, mockEM } = createRepository({
        metadata: mockMetadataWithRelations,
      });
      const prepared = { ...entityA, version: 2 } as TestEntity;
      const hydrated = { ...entityA, version: 2 } as TestEntity;

      mockEM.updateStrategy = "update";
      mockEM.update.mockReturnValue(prepared);
      executor.executeUpdate.mockResolvedValue(hydrated);

      const result = await repo.update(entityA);

      expect(mockEM.update).toHaveBeenCalledWith(entityA);
      expect(mockEM.validate).toHaveBeenCalledWith(prepared);
      expect(mockSaveOwning).toHaveBeenCalledWith(prepared, "update");
      expect(mockEM.beforeUpdate).toHaveBeenCalledWith(prepared);
      expect(executor.executeUpdate).toHaveBeenCalledWith(prepared);
      expect(mockEM.afterUpdate).toHaveBeenCalledWith(hydrated);
      expect(mockSaveInverse).toHaveBeenCalledWith(hydrated, "update");
      expect(result).toBe(hydrated);
    });

    test("calls wrapPgError when executeUpdate throws", async () => {
      const { repo, executor, mockEM } = createRepository();

      mockEM.updateStrategy = "update";
      mockEM.update.mockReturnValue(entityA);
      executor.executeUpdate.mockRejectedValue(new Error("update error"));

      await expect(repo.update(entityA)).rejects.toThrow(ProteusRepositoryError);
      expect(wrapPgError).toHaveBeenCalled();
    });
  });

  describe("update (versioned)", () => {
    test("uses withImplicitTransaction for versioned update", async () => {
      const { repo, executor, mockEM, withImplicitTransaction } = createRepository({
        metadata: mockMetadataWithVersionDates,
        entityManagerOverrides: { updateStrategy: "version" },
      });

      const partial = { endAt: new Date("2024-06-01") };
      const newVersion = { ...entityA, versionId: "new-version-id" } as any;

      mockEM.updateStrategy = "version";
      mockEM.versionUpdate.mockReturnValue(partial);
      mockEM.versionCopy.mockReturnValue(newVersion);
      mockEM.validate.mockReturnValue(undefined);
      executor.executeUpdateMany.mockResolvedValue(1);
      executor.executeInsert.mockResolvedValue(newVersion);

      await repo.update(entityA);

      expect(withImplicitTransaction).toHaveBeenCalled();
    });

    test("closes current row via executeUpdateMany then inserts new version via executeInsert", async () => {
      const { repo, executor, mockEM } = createRepository({
        metadata: mockMetadataWithVersionDates,
        entityManagerOverrides: { updateStrategy: "version" },
      });

      const partial = { endAt: new Date("2024-06-01") };
      const newVersion = { ...entityA } as any;

      mockEM.updateStrategy = "version";
      mockEM.versionUpdate.mockReturnValue(partial);
      mockEM.versionCopy.mockReturnValue(newVersion);
      executor.executeUpdateMany.mockResolvedValue(1);
      executor.executeInsert.mockResolvedValue(newVersion);

      await repo.update(entityA);

      expect(executor.executeUpdateMany).toHaveBeenCalledWith(
        { id: entityA.id, endAt: null },
        expect.any(Object),
      );
      expect(executor.executeInsert).toHaveBeenCalledWith(newVersion);
    });

    test("uses beforeUpdate/afterUpdate on new version row (intent-based hooks)", async () => {
      const { repo, executor, mockEM } = createRepository({
        metadata: mockMetadataWithVersionDates,
        entityManagerOverrides: { updateStrategy: "version" },
      });

      const partial = { endAt: null };
      const newVersion = { ...entityA } as any;

      mockEM.updateStrategy = "version";
      mockEM.versionUpdate.mockReturnValue(partial);
      mockEM.versionCopy.mockReturnValue(newVersion);
      executor.executeUpdateMany.mockResolvedValue(1);
      executor.executeInsert.mockResolvedValue(newVersion);

      await repo.update(entityA);

      expect(mockEM.beforeUpdate).toHaveBeenCalledWith(newVersion);
      expect(mockEM.afterUpdate).toHaveBeenCalledWith(newVersion);
      expect(mockEM.beforeInsert).not.toHaveBeenCalled();
      expect(mockEM.afterInsert).not.toHaveBeenCalled();
    });

    test("sets versionEndDate on partial before closing current row", async () => {
      const { repo, executor, mockEM } = createRepository({
        metadata: mockMetadataWithVersionDates,
        entityManagerOverrides: { updateStrategy: "version" },
      });

      const partial: any = {};
      const newVersion = { ...entityA } as any;

      mockEM.updateStrategy = "version";
      mockEM.versionUpdate.mockReturnValue(partial);
      mockEM.versionCopy.mockReturnValue(newVersion);
      executor.executeUpdateMany.mockResolvedValue(1);
      executor.executeInsert.mockResolvedValue(newVersion);

      await repo.update(entityA);

      const updateManyCall = executor.executeUpdateMany.mock.calls[0][1] as any;
      expect(updateManyCall.endAt).toBeInstanceOf(Date);
    });

    test("wraps error via wrapPgError", async () => {
      const { repo, executor, mockEM } = createRepository({
        metadata: mockMetadataWithVersionDates,
        entityManagerOverrides: { updateStrategy: "version" },
      });

      mockEM.updateStrategy = "version";
      mockEM.versionUpdate.mockReturnValue({});
      mockEM.versionCopy.mockReturnValue(entityA);
      executor.executeUpdateMany.mockRejectedValue(new Error("tx error"));

      await expect(repo.update(entityA)).rejects.toThrow(ProteusRepositoryError);
      expect(wrapPgError).toHaveBeenCalled();
    });

    test("throws ProteusRepositoryError with optimistic lock message when close-old-row matches zero rows", async () => {
      const { repo, executor, mockEM } = createRepository({
        metadata: mockMetadataWithVersionDates,
        entityManagerOverrides: { updateStrategy: "version" },
      });

      // Configure wrapPgError to pass through ProteusError instances (mirrors real implementation)
      const { ProteusError } = await vi.importActual<
        typeof import("../../../../errors/ProteusError")
      >("../../../../errors/ProteusError");
      (wrapPgError as unknown as Mock).mockImplementation(
        (error: unknown, message: string) => {
          if (error instanceof ProteusError) throw error;
          throw new ProteusRepositoryError(message);
        },
      );

      mockEM.updateStrategy = "version";
      mockEM.versionUpdate.mockReturnValue({});
      mockEM.versionCopy.mockReturnValue(entityA);
      // Simulate concurrent modification: the row with VersionEndDate IS NULL was already closed
      executor.executeUpdateMany.mockResolvedValue(0);

      const error = await repo.update(entityA).catch((e) => e);

      expect(error).toBeInstanceOf(ProteusRepositoryError);
      expect(error.message).toContain("Optimistic lock conflict");
      expect(error.message).toContain("TestEntity");
    });
  });

  describe("update (array)", () => {
    test("updates each entity sequentially and returns array", async () => {
      const { repo, executor, mockEM } = createRepository();
      const hydratedA = { ...entityA } as TestEntity;
      const hydratedB = { ...entityB } as TestEntity;

      mockEM.updateStrategy = "update";
      mockEM.update.mockReturnValueOnce(entityA).mockReturnValueOnce(entityB);
      executor.executeUpdate
        .mockResolvedValueOnce(hydratedA)
        .mockResolvedValueOnce(hydratedB);

      const result = await repo.update([entityA, entityB]);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });
  });

  // ─── Save ─────────────────────────────────────────────────────────────────

  describe("save", () => {
    test("routes to insert path and fires BeforeSave/AfterSave when getSaveStrategy returns 'insert'", async () => {
      const { repo, executor, mockEM } = createRepository();
      const hydrated = { ...entityA } as TestEntity;

      mockEM.getSaveStrategy.mockReturnValue("insert");
      mockEM.insert.mockResolvedValue(entityA);
      executor.executeInsert.mockResolvedValue(hydrated);

      const result = await repo.save(entityA);

      expect(executor.executeInsert).toHaveBeenCalled();
      expect(executor.executeUpdate).not.toHaveBeenCalled();
      expect(mockEM.beforeSave).toHaveBeenCalledWith(entityA);
      expect(mockEM.afterSave).toHaveBeenCalledWith(hydrated);
      expect(mockEM.beforeInsert).not.toHaveBeenCalled();
      expect(mockEM.afterInsert).not.toHaveBeenCalled();
      expect(result).toBe(hydrated);
    });

    test("routes to update path and fires BeforeSave/AfterSave when getSaveStrategy returns 'update'", async () => {
      const { repo, executor, mockEM } = createRepository();
      const hydrated = { ...entityA } as TestEntity;

      mockEM.getSaveStrategy.mockReturnValue("update");
      mockEM.update.mockReturnValue(entityA);
      executor.executeUpdate.mockResolvedValue(hydrated);

      const result = await repo.save(entityA);

      expect(executor.executeUpdate).toHaveBeenCalled();
      expect(executor.executeInsert).not.toHaveBeenCalled();
      expect(mockEM.beforeSave).toHaveBeenCalledWith(entityA);
      expect(mockEM.afterSave).toHaveBeenCalledWith(hydrated);
      expect(mockEM.beforeUpdate).not.toHaveBeenCalled();
      expect(mockEM.afterUpdate).not.toHaveBeenCalled();
      expect(result).toBe(hydrated);
    });

    test("routes to updateOne when entity exists and strategy is 'unknown'", async () => {
      const { repo, executor, mockEM } = createRepository();
      const hydrated = { ...entityA } as TestEntity;

      mockEM.getSaveStrategy.mockReturnValue("unknown");
      // exists() with { withDeleted: true } delegates to executeCount
      executor.executeCount.mockResolvedValue(1);
      mockEM.update.mockReturnValue(entityA);
      executor.executeUpdate.mockResolvedValue(hydrated);

      await repo.save(entityA);

      expect(executor.executeCount).toHaveBeenCalled();
      expect(executor.executeUpdate).toHaveBeenCalled();
    });

    test("routes to insertOne when entity does not exist and strategy is 'unknown'", async () => {
      const { repo, executor, mockEM } = createRepository();
      const hydrated = { ...entityA } as TestEntity;

      mockEM.getSaveStrategy.mockReturnValue("unknown");
      // exists() with { withDeleted: true } delegates to executeCount
      executor.executeCount.mockResolvedValue(0);
      mockEM.insert.mockResolvedValue(entityA);
      executor.executeInsert.mockResolvedValue(hydrated);

      await repo.save(entityA);

      expect(executor.executeInsert).toHaveBeenCalled();
    });

    test("falls back to updateOne on DuplicateKeyError during 'unknown' insert", async () => {
      const { repo, executor, mockEM } = createRepository();
      const hydrated = { ...entityA } as TestEntity;

      mockEM.getSaveStrategy.mockReturnValue("unknown");
      // exists() with { withDeleted: true } delegates to executeCount
      executor.executeCount.mockResolvedValue(0);
      mockEM.insert.mockResolvedValue(entityA);
      // First executeInsert throws DuplicateKeyError
      executor.executeInsert.mockRejectedValueOnce(new DuplicateKeyError("duplicate"));
      // Second path: update
      mockEM.update.mockReturnValue(entityA);
      executor.executeUpdate.mockResolvedValue(hydrated);

      // wrapPgError should re-throw as DuplicateKeyError for unique violations
      (wrapPgError as unknown as Mock).mockImplementation((error: unknown) => {
        if (error instanceof DuplicateKeyError) throw error;
        throw new ProteusRepositoryError("wrapped");
      });

      const result = await repo.save(entityA);

      expect(executor.executeUpdate).toHaveBeenCalled();
      expect(result).toBe(hydrated);
    });

    test("re-throws non-DuplicateKeyError during 'unknown' insert", async () => {
      const { repo, executor, mockEM } = createRepository();

      mockEM.getSaveStrategy.mockReturnValue("unknown");
      executor.executeExists.mockResolvedValue(false);
      mockEM.insert.mockResolvedValue(entityA);
      executor.executeInsert.mockRejectedValue(new Error("db crash"));

      await expect(repo.save(entityA)).rejects.toThrow(ProteusRepositoryError);
    });

    test("saves array of entities sequentially", async () => {
      const { repo, executor, mockEM } = createRepository();

      mockEM.getSaveStrategy.mockReturnValue("insert");
      mockEM.insert.mockResolvedValue(entityA);
      executor.executeInsert.mockResolvedValue(entityA);

      const result = await repo.save([entityA, entityB]);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });
  });

  // ─── Clone ────────────────────────────────────────────────────────────────

  describe("clone", () => {
    test("fast path: no relations — skips transaction and relation helpers", async () => {
      const { repo, executor, mockEM, withImplicitTransaction } = createRepository();
      const cloned = { ...entityA, id: undefined } as any;
      const hydrated = { ...entityA, id: "new-id" } as TestEntity;

      mockEM.clone.mockResolvedValue(cloned);
      executor.executeInsert.mockResolvedValue(hydrated);

      const result = await repo.clone(entityA);

      expect(mockEM.clone).toHaveBeenCalledWith(entityA);
      expect(mockEM.validate).toHaveBeenCalledWith(cloned);
      expect(withImplicitTransaction).not.toHaveBeenCalled();
      expect(mockSaveOwning).not.toHaveBeenCalled();
      expect(mockSaveInverse).not.toHaveBeenCalled();
      expect(mockEM.beforeInsert).toHaveBeenCalledWith(cloned);
      expect(executor.executeInsert).toHaveBeenCalledWith(cloned);
      expect(mockEM.afterInsert).toHaveBeenCalledWith(hydrated);
      expect(result).toBe(hydrated);
    });

    test("transaction path: with relations — calls saveOwning/saveInverse within transaction", async () => {
      const { repo, executor, mockEM } = createRepository({
        metadata: mockMetadataWithRelations,
      });
      const cloned = { ...entityA, id: undefined } as any;
      const hydrated = { ...entityA, id: "new-id" } as TestEntity;

      mockEM.clone.mockResolvedValue(cloned);
      executor.executeInsert.mockResolvedValue(hydrated);

      const result = await repo.clone(entityA);

      expect(mockEM.clone).toHaveBeenCalledWith(entityA);
      expect(mockEM.validate).toHaveBeenCalledWith(cloned);
      expect(mockSaveOwning).toHaveBeenCalledWith(cloned, "insert");
      expect(mockEM.beforeInsert).toHaveBeenCalledWith(cloned);
      expect(executor.executeInsert).toHaveBeenCalledWith(cloned);
      expect(mockEM.afterInsert).toHaveBeenCalledWith(hydrated);
      expect(mockSaveInverse).toHaveBeenCalledWith(hydrated, "insert");
      expect(result).toBe(hydrated);
    });

    test("calls wrapPgError on error", async () => {
      const { repo, mockEM } = createRepository();
      mockEM.clone.mockRejectedValue(new Error("clone error"));

      await expect(repo.clone(entityA)).rejects.toThrow(ProteusRepositoryError);
      expect(wrapPgError).toHaveBeenCalled();
    });

    test("clones array of entities sequentially", async () => {
      const { repo, executor, mockEM } = createRepository();
      const cloned = { ...entityA } as TestEntity;

      mockEM.clone.mockResolvedValue(cloned);
      executor.executeInsert.mockResolvedValue(cloned);

      const result = await repo.clone([entityA, entityB]);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });
  });

  // ─── Destroy ─────────────────────────────────────────────────────────────

  describe("destroy", () => {
    test("fast path: no relations — skips transaction and RelationPersister.destroy", async () => {
      const { repo, executor, mockEM, withImplicitTransaction } = createRepository();
      executor.executeDelete.mockResolvedValue(undefined);

      await repo.destroy(entityA);

      expect(mockEM.beforeDestroy).toHaveBeenCalledWith(entityA);
      expect(withImplicitTransaction).not.toHaveBeenCalled();
      expect(mockDestroy).not.toHaveBeenCalled();
      expect(executor.executeDelete).toHaveBeenCalledWith({ id: entityA.id });
      expect(mockEM.afterDestroy).toHaveBeenCalledWith(entityA);
    });

    test("transaction path: with relations — calls RelationPersister.destroy within transaction", async () => {
      const { repo, executor, mockEM, repositoryFactory, client } = createRepository({
        metadata: mockMetadataWithRelations,
      });
      executor.executeDelete.mockResolvedValue(undefined);

      await repo.destroy(entityA);

      expect(mockEM.beforeDestroy).toHaveBeenCalledWith(entityA);
      expect(mockDestroy).toHaveBeenCalledWith(entityA);
      expect(executor.executeDelete).toHaveBeenCalledWith({ id: entityA.id });
      expect(mockEM.afterDestroy).toHaveBeenCalledWith(entityA);
    });

    test("calls wrapPgError on error", async () => {
      const { repo, executor, mockEM } = createRepository();
      executor.executeDelete.mockRejectedValue(new Error("db error"));

      await expect(repo.destroy(entityA)).rejects.toThrow(ProteusRepositoryError);
      expect(wrapPgError).toHaveBeenCalled();
    });

    test("destroys array of entities sequentially", async () => {
      const { repo, executor } = createRepository();
      executor.executeDelete.mockResolvedValue(undefined);

      await repo.destroy([entityA, entityB]);

      expect(executor.executeDelete).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Soft Destroy ─────────────────────────────────────────────────────────

  describe("softDestroy", () => {
    test("throws guardDeleteDateField error when guard rejects", async () => {
      (guardDeleteDateField as Mock).mockImplementation(() => {
        throw new ProteusRepositoryError(
          'softDestroy() requires @DeleteDateField on "MockEntity"',
        );
      });
      const { repo } = createRepository({ metadata: mockMetadata });

      await expect(repo.softDestroy(entityA)).rejects.toThrow(ProteusRepositoryError);
      await expect(repo.softDestroy(entityA)).rejects.toThrow("softDestroy");
    });

    test("fast path: no relations — skips transaction and RelationPersister.destroy", async () => {
      const { repo, executor, mockEM, withImplicitTransaction } = createRepository({
        metadata: mockMetadataWithDeleteDate,
      });
      executor.executeSoftDelete.mockResolvedValue(undefined);

      await repo.softDestroy(entityA);

      expect(mockEM.beforeSoftDestroy).toHaveBeenCalledWith(entityA);
      expect(withImplicitTransaction).not.toHaveBeenCalled();
      expect(mockDestroy).not.toHaveBeenCalled();
      expect(executor.executeSoftDelete).toHaveBeenCalledWith({ id: entityA.id });
      expect(mockEM.afterSoftDestroy).toHaveBeenCalledWith(entityA);
    });

    test("transaction path: with relations — calls RelationPersister.destroy within transaction", async () => {
      const metaWithDeleteDateAndRelations = {
        ...mockMetadataWithDeleteDate,
        relations: mockMetadataWithRelations.relations,
      } as unknown as EntityMetadata;
      const { repo, executor, mockEM } = createRepository({
        metadata: metaWithDeleteDateAndRelations,
      });
      executor.executeSoftDelete.mockResolvedValue(undefined);

      await repo.softDestroy(entityA);

      expect(mockEM.beforeSoftDestroy).toHaveBeenCalledWith(entityA);
      expect(mockDestroy).toHaveBeenCalled();
      expect(executor.executeSoftDelete).toHaveBeenCalledWith({ id: entityA.id });
      expect(mockEM.afterSoftDestroy).toHaveBeenCalledWith(entityA);
    });

    test("calls wrapPgError on error", async () => {
      const { repo, executor, mockEM } = createRepository({
        metadata: mockMetadataWithDeleteDate,
      });
      executor.executeSoftDelete.mockRejectedValue(new Error("soft error"));

      await expect(repo.softDestroy(entityA)).rejects.toThrow(ProteusRepositoryError);
      expect(wrapPgError).toHaveBeenCalled();
    });

    test("soft-destroys array of entities sequentially", async () => {
      const { repo, executor } = createRepository({
        metadata: mockMetadataWithDeleteDate,
      });
      executor.executeSoftDelete.mockResolvedValue(undefined);

      await repo.softDestroy([entityA, entityB]);

      expect(executor.executeSoftDelete).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Guards ───────────────────────────────────────────────────────────────

  describe("guardDeleteDateField", () => {
    test("softDelete calls guardDeleteDateField with metadata", async () => {
      const { repo, executor } = createRepository({
        metadata: mockMetadataWithDeleteDate,
      });
      executor.executeSoftDelete.mockResolvedValue(undefined);

      await repo.softDelete({ id: "x" } as any);

      expect(guardDeleteDateField).toHaveBeenCalledWith(
        mockMetadataWithDeleteDate,
        "softDelete",
      );
    });

    test("restore calls guardDeleteDateField with metadata", async () => {
      const { repo, executor } = createRepository({
        metadata: mockMetadataWithDeleteDate,
      });
      executor.executeRestore.mockResolvedValue(undefined);

      await repo.restore({ id: "x" } as any);

      expect(guardDeleteDateField).toHaveBeenCalledWith(
        mockMetadataWithDeleteDate,
        "restore",
      );
    });

    test("propagates guard error", async () => {
      (guardDeleteDateField as Mock).mockImplementation(() => {
        throw new ProteusRepositoryError(
          'softDelete() requires @DeleteDateField on "MockEntity"',
        );
      });
      const { repo } = createRepository({ metadata: mockMetadata });

      await expect(repo.softDelete({ id: "x" } as any)).rejects.toThrow(
        ProteusRepositoryError,
      );
    });
  });

  describe("guardExpiryDateField", () => {
    test("ttl calls guardExpiryDateField with metadata", async () => {
      const { repo, executor } = createRepository({
        metadata: mockMetadataWithExpiryDate,
      });
      executor.executeTtl.mockResolvedValue(3600);

      await repo.ttl({ id: "x" } as any);

      expect(guardExpiryDateField).toHaveBeenCalledWith(
        mockMetadataWithExpiryDate,
        "ttl",
      );
    });

    test("deleteExpired calls guardExpiryDateField with metadata", async () => {
      const { repo, executor } = createRepository({
        metadata: mockMetadataWithExpiryDate,
      });
      executor.executeDeleteExpired.mockResolvedValue(undefined);

      await repo.deleteExpired();

      expect(guardExpiryDateField).toHaveBeenCalledWith(
        mockMetadataWithExpiryDate,
        "deleteExpired",
      );
    });

    test("propagates guard error", async () => {
      (guardExpiryDateField as Mock).mockImplementation(() => {
        throw new ProteusRepositoryError(
          'ttl() requires @ExpiryDateField on "MockEntity"',
        );
      });
      const { repo } = createRepository({ metadata: mockMetadata });

      await expect(repo.ttl({ id: "x" } as any)).rejects.toThrow(ProteusRepositoryError);
    });
  });

  describe("guardVersionFields", () => {
    test("versions() calls guardVersionFields with metadata", async () => {
      const { repo, executor } = createRepository({
        metadata: mockMetadataWithVersionDates,
      });
      executor.executeFind.mockResolvedValue([entityA]);

      await repo.versions({ id: "x" } as any);

      expect(guardVersionFields).toHaveBeenCalledWith(
        mockMetadataWithVersionDates,
        "versions",
      );
    });

    test("propagates guard error", async () => {
      (guardVersionFields as Mock).mockImplementation(() => {
        throw new ProteusRepositoryError(
          "versions() requires @VersionStartDateField and @VersionEndDateField",
        );
      });
      const { repo } = createRepository({ metadata: mockMetadata });

      await expect(repo.versions({ id: "x" } as any)).rejects.toThrow(
        ProteusRepositoryError,
      );
    });

    test("versions() passes withDeleted and withAllVersions to executeFind", async () => {
      const { repo, executor } = createRepository({
        metadata: mockMetadataWithVersionDates,
      });
      executor.executeFind.mockResolvedValue([entityA]);

      await repo.versions({ id: "x" } as any);

      expect(executor.executeFind).toHaveBeenCalledWith(
        { id: "x" },
        expect.objectContaining({ withDeleted: true, withAllVersions: true }),
        "multiple",
      );
    });
  });

  // ─── TTL ──────────────────────────────────────────────────────────────────

  describe("ttl", () => {
    test("returns TTL milliseconds from executeTtl", async () => {
      const { repo, executor } = createRepository({
        metadata: mockMetadataWithExpiryDate,
      });
      executor.executeTtl.mockResolvedValue(3600);

      const result = await repo.ttl({ id: "x" } as any);

      expect(executor.executeTtl).toHaveBeenCalledWith({ id: "x" });
      expect(result).toBe(3600);
    });

    test("throws when executeTtl returns null (entity not found)", async () => {
      const { repo, executor } = createRepository({
        metadata: mockMetadataWithExpiryDate,
      });
      executor.executeTtl.mockResolvedValue(null);

      await expect(repo.ttl({ id: "x" } as any)).rejects.toThrow(ProteusRepositoryError);
    });

    test("accepts optional options parameter", async () => {
      const { repo, executor } = createRepository({
        metadata: mockMetadataWithExpiryDate,
      });
      executor.executeTtl.mockResolvedValue(100);

      // Should not throw with options parameter
      await expect(repo.ttl({ id: "x" } as any, { withDeleted: true })).resolves.toBe(
        100,
      );
    });
  });

  // ─── Versions ─────────────────────────────────────────────────────────────

  describe("versions", () => {
    test("always passes withDeleted: true to executeFind", async () => {
      const { repo, executor } = createRepository({
        metadata: mockMetadataWithVersionDates,
      });
      executor.executeFind.mockResolvedValue([entityA]);

      await repo.versions({ id: "x" } as any);

      expect(executor.executeFind).toHaveBeenCalledWith(
        { id: "x" },
        expect.objectContaining({ withDeleted: true }),
        "multiple",
      );
    });

    test("calls afterLoad on each entity", async () => {
      const { repo, executor, mockEM } = createRepository({
        metadata: mockMetadataWithVersionDates,
      });
      executor.executeFind.mockResolvedValue([entityA, entityB]);

      await repo.versions({} as any);

      expect(mockEM.afterLoad).toHaveBeenCalledWith(entityA);
      expect(mockEM.afterLoad).toHaveBeenCalledWith(entityB);
    });
  });

  // ─── Increment / Decrement ────────────────────────────────────────────────

  describe("increment", () => {
    test("delegates to executor.executeIncrement", async () => {
      const { repo, executor } = createRepository();
      executor.executeIncrement.mockResolvedValue(undefined);

      await repo.increment({ id: "x" } as any, "version" as keyof TestEntity, 3);

      expect(executor.executeIncrement).toHaveBeenCalledWith({ id: "x" }, "version", 3);
    });
  });

  describe("decrement", () => {
    test("delegates to executor.executeDecrement", async () => {
      const { repo, executor } = createRepository();
      executor.executeDecrement.mockResolvedValue(undefined);

      await repo.decrement({ id: "x" } as any, "version" as keyof TestEntity, 2);

      expect(executor.executeDecrement).toHaveBeenCalledWith({ id: "x" }, "version", 2);
    });
  });

  // ─── Delete (criteria-based) ──────────────────────────────────────────────

  describe("delete", () => {
    test("delegates to executor.executeDelete with criteria", async () => {
      const { repo, executor } = createRepository();
      executor.executeDelete.mockResolvedValue(undefined);

      await repo.delete({ name: "x" } as any);

      expect(executor.executeDelete).toHaveBeenCalledWith({ name: "x" });
    });
  });

  // ─── UpdateMany ──────────────────────────────────────────────────────────

  describe("updateMany", () => {
    test("calls executeUpdateMany with criteria and update", async () => {
      const { repo, executor, mockEM } = createRepository();
      executor.executeUpdateMany.mockResolvedValue(1);

      await repo.updateMany({ name: "old" } as any, { name: "new" } as any);

      expect(mockEM.verifyReadonly).toHaveBeenCalledWith({ name: "new" });
      expect(executor.executeUpdateMany).toHaveBeenCalledWith(
        { name: "old" },
        { name: "new" },
      );
    });

    test("throws for versioned entities", async () => {
      const { repo } = createRepository({
        metadata: mockMetadataWithVersionDates,
        entityManagerOverrides: { updateStrategy: "version" },
      });

      await expect(
        repo.updateMany({ id: "x" } as any, { name: "new" } as any),
      ).rejects.toThrow(ProteusRepositoryError);
    });
  });

  // ─── SoftDelete (criteria-based) ──────────────────────────────────────────

  describe("softDelete (criteria)", () => {
    test("delegates to executor.executeSoftDelete", async () => {
      const { repo, executor } = createRepository({
        metadata: mockMetadataWithDeleteDate,
      });
      executor.executeSoftDelete.mockResolvedValue(undefined);

      await repo.softDelete({ id: "x" } as any);

      expect(executor.executeSoftDelete).toHaveBeenCalledWith({ id: "x" });
    });
  });

  describe("restore", () => {
    test("delegates to executor.executeRestore", async () => {
      const { repo, executor } = createRepository({
        metadata: mockMetadataWithDeleteDate,
      });
      executor.executeRestore.mockResolvedValue(undefined);

      await repo.restore({ id: "x" } as any);

      expect(executor.executeRestore).toHaveBeenCalledWith({ id: "x" });
    });
  });

  describe("deleteExpired", () => {
    test("delegates to executor.executeDeleteExpired", async () => {
      const { repo, executor } = createRepository({
        metadata: mockMetadataWithExpiryDate,
      });
      executor.executeDeleteExpired.mockResolvedValue(undefined);

      await repo.deleteExpired();

      expect(executor.executeDeleteExpired).toHaveBeenCalled();
    });
  });

  // ─── QueryBuilder / Setup ────────────────────────────────────────────────

  describe("queryBuilder", () => {
    test("returns result of queryBuilderFactory", () => {
      const { repo } = createRepository();
      const qb = repo.queryBuilder();

      expect(qb).toBeDefined();
    });
  });

  describe("setup", () => {
    test("resolves immediately (no-op)", async () => {
      const { repo } = createRepository();

      await expect(repo.setup()).resolves.toBeUndefined();
    });
  });

  // ─── findOneOrSave ────────────────────────────────────────────────────────

  describe("findOneOrSave", () => {
    test("returns existing entity when found", async () => {
      const { repo, executor, mockEM } = createRepository();
      executor.executeFind.mockResolvedValue([entityA]);

      const result = await repo.findOneOrSave(
        { id: entityA.id } as any,
        { name: "New" } as any,
      );

      expect(result).toBe(entityA);
      expect(executor.executeInsert).not.toHaveBeenCalled();
    });

    test("saves and returns new entity when not found", async () => {
      const { repo, executor, mockEM } = createRepository();
      const hydrated = { ...entityA, id: "new-entity-id" } as TestEntity;

      executor.executeFind.mockResolvedValue([]);
      mockEM.getSaveStrategy.mockReturnValue("insert");
      mockEM.insert.mockResolvedValue(entityA);
      executor.executeInsert.mockResolvedValue(hydrated);

      const result = await repo.findOneOrSave(
        { id: "missing" } as any,
        { name: "New" } as any,
      );

      expect(executor.executeInsert).toHaveBeenCalled();
      expect(result).toBe(hydrated);
    });
  });

  // ─── Upsert ───────────────────────────────────────────────────────────────────

  describe("upsert", () => {
    test("compiles upsert SQL, executes, and hydrates result", async () => {
      const { repo, client, mockEM } = createRepository();

      mockEM.insert.mockResolvedValue(entityA);
      const compiledSql = { text: "INSERT INTO ... ON CONFLICT ...", params: ["val1"] };
      (compileUpsert as Mock).mockReturnValue(compiledSql);
      (client.query as Mock).mockResolvedValue({
        rows: [{ id: "entity-id-1", name: "Entity A" }],
        rowCount: 1,
      });
      (hydrateReturning as Mock).mockReturnValue(entityA);

      const result = await repo.upsert(entityA);

      expect(mockEM.insert).toHaveBeenCalledWith(entityA);
      expect(compileUpsert).toHaveBeenCalledWith(
        entityA,
        mockMetadata,
        null,
        undefined,
        undefined,
      );
      expect(client.query).toHaveBeenCalledWith(compiledSql.text, compiledSql.params);
      expect(hydrateReturning).toHaveBeenCalled();
      expect(result).toBe(entityA);
    });

    test("runs insert and validate before compiling SQL", async () => {
      const { repo, client, mockEM } = createRepository();

      const callOrder: Array<string> = [];
      mockEM.insert.mockImplementation(async (e: any) => {
        callOrder.push("insert");
        return e;
      });
      mockEM.validate.mockImplementation(() => {
        callOrder.push("validate");
      });
      (compileUpsert as Mock).mockImplementation(() => {
        callOrder.push("compileUpsert");
        return { text: "SQL", params: [] };
      });
      (client.query as Mock).mockResolvedValue({ rows: [{}], rowCount: 1 });
      (hydrateReturning as Mock).mockReturnValue(entityA);

      await repo.upsert(entityA);

      expect(callOrder).toEqual(["insert", "validate", "compileUpsert"]);
    });

    test("calls guardUpsertBlocked with metadata", async () => {
      const { repo, client, mockEM } = createRepository();
      mockEM.insert.mockResolvedValue(entityA);
      (compileUpsert as Mock).mockReturnValue({ text: "SQL", params: [] });
      (client.query as Mock).mockResolvedValue({ rows: [{}], rowCount: 1 });
      (hydrateReturning as Mock).mockReturnValue(entityA);

      await repo.upsert(entityA);

      expect(guardUpsertBlocked).toHaveBeenCalledWith(mockMetadata);
    });

    test("propagates guardUpsertBlocked error", async () => {
      (guardUpsertBlocked as Mock).mockImplementation(() => {
        throw new ProteusRepositoryError(
          'upsert() is not supported on versioned entity "MockEntity"',
        );
      });
      const { repo } = createRepository();

      await expect(repo.upsert(entityA)).rejects.toThrow(ProteusRepositoryError);
    });

    test("upsertOne fires beforeInsert and afterInsert hooks", async () => {
      const prepared = { ...entityA, id: "prepared-id" } as TestEntity;
      const hydrated = { ...entityA, id: "hydrated-id" } as TestEntity;
      const { repo, client, mockEM } = createRepository();

      mockEM.insert.mockResolvedValue(prepared);
      (compileUpsert as Mock).mockReturnValue({ text: "UPSERT SQL", params: [] });
      (client.query as Mock).mockResolvedValue({ rows: [{}], rowCount: 1 });
      (hydrateReturning as Mock).mockReturnValue(hydrated);

      await repo.upsert(entityA);

      expect(mockEM.beforeInsert).toHaveBeenCalledWith(prepared);
      expect(mockEM.afterInsert).toHaveBeenCalledWith(hydrated);
    });

    test("upsertOne fires beforeInsert hook before SQL and afterInsert hook after SQL", async () => {
      const prepared = { ...entityA, id: "prepared-id" } as TestEntity;
      const hydrated = { ...entityA, id: "hydrated-id" } as TestEntity;
      const callOrder: Array<string> = [];
      const { repo, client, mockEM } = createRepository();

      mockEM.insert.mockResolvedValue(prepared);
      mockEM.beforeInsert.mockImplementation(async () => {
        callOrder.push("beforeInsert");
      });
      mockEM.afterInsert.mockImplementation(async () => {
        callOrder.push("afterInsert");
      });
      (compileUpsert as Mock).mockReturnValue({ text: "UPSERT SQL", params: [] });
      (client.query as Mock).mockImplementation(async () => {
        callOrder.push("query");
        return { rows: [{}], rowCount: 1 };
      });
      (hydrateReturning as Mock).mockReturnValue(hydrated);

      await repo.upsert(entityA);

      expect(callOrder.indexOf("beforeInsert")).toBeLessThan(callOrder.indexOf("query"));
      expect(callOrder.indexOf("query")).toBeLessThan(callOrder.indexOf("afterInsert"));
    });

    test("upsertOne fires beforeInsert and afterInsert entity events", async () => {
      const prepared = { ...entityA, id: "prepared-id" } as TestEntity;
      const hydrated = { ...entityA, id: "hydrated-id" } as TestEntity;
      const emitEntity = vi.fn().mockResolvedValue(undefined);

      const meta = mockMetadata;
      const executor = createMockExecutor();
      const client = createMockClient();
      const logger = createMockLogger();
      const mockEM = createMockEntityManager();

      (getEntityMetadata as Mock).mockReturnValue(meta);
      const MockEntityManager = EntityManager as MockedClass<
        typeof EntityManager<TestEntity>
      >;
      MockEntityManager.mockImplementation(function () {
        return mockEM;
      });

      const repositoryFactory = vi.fn();
      const withImplicitTransaction = vi
        .fn()
        .mockImplementation(async (fn: any) =>
          fn({ client, executor, repositoryFactory }),
        );

      const repo = new PostgresRepository<TestEntity>({
        target: TestEntity,
        executor,
        queryBuilderFactory: vi.fn().mockReturnValue({ build: vi.fn() }),
        client,
        namespace: null,
        logger,
        repositoryFactory,
        withImplicitTransaction,
        emitEntity,
      });

      mockEM.insert.mockResolvedValue(prepared);
      (compileUpsert as Mock).mockReturnValue({ text: "UPSERT SQL", params: [] });
      (client.query as Mock).mockResolvedValue({ rows: [{}], rowCount: 1 });
      (hydrateReturning as Mock).mockReturnValue(hydrated);

      await repo.upsert(entityA);

      expect(emitEntity).toHaveBeenCalledWith(
        "entity:before-insert",
        expect.objectContaining({ entity: prepared }),
      );
      expect(emitEntity).toHaveBeenCalledWith(
        "entity:after-insert",
        expect.objectContaining({ entity: hydrated }),
      );
    });
  });

  // ─── Aggregates ───────────────────────────────────────────────────────────────

  describe("aggregates", () => {
    beforeEach(() => {
      (compileAggregate as Mock).mockReturnValue({
        text: "SELECT SUM(...)",
        params: [],
      });
    });

    test("sum compiles and returns numeric result", async () => {
      const { repo, client } = createRepository();
      (client.query as Mock).mockResolvedValue({
        rows: [{ result: "42" }],
        rowCount: 1,
      });

      const result = await repo.sum("name" as keyof TestEntity);

      expect(compileAggregate).toHaveBeenCalledWith(
        "SUM",
        "name",
        expect.any(Object),
        mockMetadata,
        null,
      );
      expect(result).toBe(42);
    });

    test("average compiles with AVG", async () => {
      const { repo, client } = createRepository();
      (client.query as Mock).mockResolvedValue({
        rows: [{ result: "3.14" }],
        rowCount: 1,
      });

      const result = await repo.average("name" as keyof TestEntity);

      expect(compileAggregate).toHaveBeenCalledWith(
        "AVG",
        "name",
        expect.any(Object),
        mockMetadata,
        null,
      );
      expect(result).toBe(3.14);
    });

    test("minimum compiles with MIN", async () => {
      const { repo, client } = createRepository();
      (client.query as Mock).mockResolvedValue({
        rows: [{ result: "1" }],
        rowCount: 1,
      });

      const result = await repo.minimum("name" as keyof TestEntity);

      expect(compileAggregate).toHaveBeenCalledWith(
        "MIN",
        "name",
        expect.any(Object),
        mockMetadata,
        null,
      );
      expect(result).toBe(1);
    });

    test("maximum compiles with MAX", async () => {
      const { repo, client } = createRepository();
      (client.query as Mock).mockResolvedValue({
        rows: [{ result: "100" }],
        rowCount: 1,
      });

      const result = await repo.maximum("name" as keyof TestEntity);

      expect(compileAggregate).toHaveBeenCalledWith(
        "MAX",
        "name",
        expect.any(Object),
        mockMetadata,
        null,
      );
      expect(result).toBe(100);
    });

    test("returns null when no rows match", async () => {
      const { repo, client } = createRepository();
      (client.query as Mock).mockResolvedValue({
        rows: [{ result: null }],
        rowCount: 1,
      });

      const result = await repo.sum("name" as keyof TestEntity);

      expect(result).toBeNull();
    });

    test("passes criteria as predicate", async () => {
      const { repo, client } = createRepository();
      (client.query as Mock).mockResolvedValue({
        rows: [{ result: "5" }],
        rowCount: 1,
      });
      const criteria = { name: "test" };

      await repo.sum("name" as keyof TestEntity, criteria as any);

      expect(compileAggregate).toHaveBeenCalledWith(
        "SUM",
        "name",
        expect.objectContaining({
          predicates: [{ predicate: criteria, conjunction: "and" }],
        }),
        mockMetadata,
        null,
      );
    });
  });

  // ─── Cursor ───────────────────────────────────────────────────────────────────

  describe("cursor", () => {
    test("throws on transactional repositories (no createCursorClient)", async () => {
      const { repo } = createRepository();

      await expect(repo.cursor()).rejects.toThrow(
        /cursor\(\) is not available on transactional repositories/,
      );
    });
  });
});
