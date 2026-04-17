/**
 * Unit tests for DriverRepositoryBase.
 *
 * DriverRepositoryBase is abstract, so we create a minimal concrete subclass
 * that delegates all abstract methods to jest mocks.
 *
 * All external dependencies (EntityManager, getEntityMetadata, guards, etc.)
 * are mocked at the module level.
 */

// ─── Module Mocks ────────────────────────────────────────────────────────────

jest.mock("../entity/classes/EntityManager", () => ({
  EntityManager: jest.fn(),
}));

jest.mock("../entity/metadata/get-entity-metadata", () => ({
  getEntityMetadata: jest.fn(),
}));

jest.mock("../utils/repository/build-pk-predicate", () => ({
  buildPrimaryKeyPredicate: jest.fn(),
}));

jest.mock("../utils/repository/repository-guards", () => ({
  guardAppendOnly: jest.fn(),
  guardDeleteDateField: jest.fn(),
  guardExpiryDateField: jest.fn(),
  guardVersionFields: jest.fn(),
  guardUpsertBlocked: jest.fn(),
  validateRelationNames: jest.fn(),
}));

jest.mock("../entity/utils/install-lazy-relations", () => ({
  installLazyRelations: jest.fn(),
}));

jest.mock("../entity/utils/lazy-relation", () => ({
  isLazyRelation: jest.fn().mockReturnValue(false),
}));

jest.mock("../entity/utils/lazy-collection", () => ({
  isLazyCollection: jest.fn().mockReturnValue(false),
}));

jest.mock("../utils/query/filter-hidden-selections", () => ({
  filterHiddenSelections: jest.fn().mockReturnValue(null),
}));

jest.mock("../utils/pagination/validate-paginate-options", () => ({
  validatePaginateOptions: jest.fn(),
}));

jest.mock("../utils/pagination/build-keyset-order", () => ({
  buildKeysetOrder: jest.fn().mockReturnValue([]),
  keysetOrderToRecord: jest.fn().mockReturnValue({}),
}));

jest.mock("../utils/pagination/build-keyset-predicate", () => ({
  buildKeysetPredicate: jest.fn().mockReturnValue({}),
}));

jest.mock("../utils/pagination/encode-cursor", () => ({
  encodeCursor: jest.fn().mockReturnValue("cursor-token"),
}));

jest.mock("../utils/pagination/decode-cursor", () => ({
  decodeCursor: jest.fn().mockReturnValue({ values: ["val1"] }),
}));

jest.mock("../utils/pagination/extract-cursor-values", () => ({
  extractCursorValues: jest.fn().mockReturnValue(["val1"]),
}));

// ─── Imports after jest.mock ──────────────────────────────────────────────────

import type { ILogger } from "@lindorm/logger";
import type { DeepPartial, Predicate } from "@lindorm/types";
import type { Constructor } from "@lindorm/types";
import { EntityManager } from "../entity/classes/EntityManager";
import { getEntityMetadata } from "../entity/metadata/get-entity-metadata";
import { buildPrimaryKeyPredicate } from "../utils/repository/build-pk-predicate";
import {
  guardAppendOnly,
  guardDeleteDateField,
  guardExpiryDateField,
  guardUpsertBlocked,
} from "../utils/repository/repository-guards";
import { filterHiddenSelections } from "../utils/query/filter-hidden-selections";
import { makeField } from "../__fixtures__/make-field";
import type { EntityMetadata } from "../entity/types/metadata";
import type { IRepositoryExecutor } from "../interfaces/RepositoryExecutor";
import type { IEntity, IProteusCursor, IProteusQueryBuilder } from "../../interfaces";
import type {
  ClearOptions,
  CursorOptions,
  FindOptions,
  UpsertOptions,
} from "../../types";
import type { QueryScope } from "../entity/types/metadata";
import type { AggregateFunction } from "../types/aggregate";
import type { LazyRelationLoader } from "../entity/utils/install-lazy-relations";
import {
  DriverRepositoryBase,
  type DriverRepositoryBaseOptions,
} from "./DriverRepositoryBase";
import { ProteusRepositoryError } from "../../errors/ProteusRepositoryError";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

class TestEntity implements IEntity {
  [key: string]: any;
  id!: string;
  version!: number;
  createdAt!: Date;
  updatedAt!: Date;
  name!: string;
}

const mockMetadata: EntityMetadata = {
  target: TestEntity,
  cache: null,
  checks: [],
  defaultOrder: null,
  embeddedLists: [],
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "TestEntity",
    namespace: null,
  } as any,
  extras: [],
  fields: [
    makeField("id", { decorator: "Field", readonly: true }),
    makeField("version", { decorator: "Version", type: "integer" }),
    makeField("createdAt", { decorator: "CreateDate", type: "timestamp" }),
    makeField("updatedAt", { decorator: "UpdateDate", type: "timestamp" }),
    makeField("name", { type: "string" }),
  ],
  filters: [],
  generated: [],
  hooks: [],
  indexes: [],
  primaryKeys: ["id"],
  relationCounts: [],
  relationIds: [],
  relations: [],
  schemas: [],
  scopeKeys: [],
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

const mockMetadataVersioned = {
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
};

// ─── Mock factory helpers ────────────────────────────────────────────────────

const createMockLogger = (): ILogger =>
  ({
    child: jest.fn().mockReturnThis(),
    silly: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as unknown as ILogger;

const createMockExecutor = (): jest.Mocked<IRepositoryExecutor<TestEntity>> => ({
  executeInsert: jest.fn(),
  executeUpdate: jest.fn(),
  executeDelete: jest.fn(),
  executeSoftDelete: jest.fn(),
  executeRestore: jest.fn(),
  executeDeleteExpired: jest.fn(),
  executeTtl: jest.fn(),
  executeFind: jest.fn(),
  executeCount: jest.fn(),
  executeExists: jest.fn(),
  executeIncrement: jest.fn(),
  executeDecrement: jest.fn(),
  executeInsertBulk: jest.fn(),
  executeUpdateMany: jest.fn(),
});

const createMockEntityManager = (overrides: Record<string, any> = {}): any => ({
  target: TestEntity,
  updateStrategy: "update",
  metadata: mockMetadata,
  create: jest.fn(),
  copy: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  clone: jest.fn(),
  validate: jest.fn(),
  beforeInsert: jest.fn().mockResolvedValue(undefined),
  afterInsert: jest.fn().mockResolvedValue(undefined),
  beforeSave: jest.fn().mockResolvedValue(undefined),
  afterSave: jest.fn().mockResolvedValue(undefined),
  beforeUpdate: jest.fn().mockResolvedValue(undefined),
  afterUpdate: jest.fn().mockResolvedValue(undefined),
  beforeDestroy: jest.fn().mockResolvedValue(undefined),
  afterDestroy: jest.fn().mockResolvedValue(undefined),
  afterLoad: jest.fn().mockResolvedValue(undefined),
  getSaveStrategy: jest.fn().mockReturnValue("update"),
  verifyReadonly: jest.fn(),
  ...overrides,
});

// ─── Concrete subclass ────────────────────────────────────────────────────────

const abstractMethods = {
  insertOne: jest.fn(),
  insertBulk: jest.fn(),
  updateOne: jest.fn(),
  cloneOne: jest.fn(),
  destroyOne: jest.fn(),
  softDestroyOne: jest.fn(),
  upsertOne: jest.fn(),
  find: jest.fn(),
  versions: jest.fn(),
  cursor: jest.fn(),
  clear: jest.fn(),
  buildLazyLoader: jest.fn<LazyRelationLoader, []>(),
  executeAggregate: jest.fn(),
  isDuplicateKeyError: jest.fn(),
};

class ConcreteRepository extends DriverRepositoryBase<TestEntity> {
  public constructor(options: DriverRepositoryBaseOptions<TestEntity>) {
    super(options);
  }

  protected insertOne = abstractMethods.insertOne;
  protected insertBulk = abstractMethods.insertBulk;
  protected updateOne = abstractMethods.updateOne;
  protected cloneOne = abstractMethods.cloneOne;
  protected destroyOne = abstractMethods.destroyOne;
  protected softDestroyOne = abstractMethods.softDestroyOne;
  protected upsertOne = abstractMethods.upsertOne;
  public find = abstractMethods.find;
  public versions = abstractMethods.versions;
  public cursor = abstractMethods.cursor;
  public clear = abstractMethods.clear;
  protected buildLazyLoader = abstractMethods.buildLazyLoader;
  protected executeAggregate = abstractMethods.executeAggregate;
  protected isDuplicateKeyError = abstractMethods.isDuplicateKeyError;

  // Expose protected methods for testing
  public exposeSaveOne = (input: any) => this.saveOne(input);
  public exposeFireBeforeHook = (kind: any, entity: TestEntity) =>
    this.fireBeforeHook(kind, entity);
  public exposeFireAfterHook = (kind: any, entity: TestEntity) =>
    this.fireAfterHook(kind, entity);
  public exposeFireSubscriber = (name: any, event: any) =>
    this.fireSubscriber(name, event);
  public exposeBuildSubscriberEvent = (entity: TestEntity, connection?: unknown) =>
    this.buildSubscriberEvent(entity, connection);
  public exposeTransferRelations = (source: TestEntity, target: TestEntity) =>
    this.transferRelations(source, target);
}

const repositoryFactory = jest.fn();
const queryBuilderFactory = jest.fn().mockReturnValue({ build: jest.fn() });

const createRepo = (
  overrides: {
    metadata?: EntityMetadata;
    entityManagerOverrides?: Record<string, any>;
    executorOverrides?: Record<string, any>;
    emitEntity?: jest.Mock;
  } = {},
) => {
  const meta = overrides.metadata ?? mockMetadata;
  const executor = createMockExecutor();
  const logger = createMockLogger();
  const mockEM = createMockEntityManager(overrides.entityManagerOverrides);

  if (overrides.executorOverrides) {
    Object.assign(executor, overrides.executorOverrides);
  }

  (getEntityMetadata as jest.Mock).mockReturnValue(meta);
  const MockEntityManager = EntityManager as jest.MockedClass<
    typeof EntityManager<TestEntity>
  >;
  MockEntityManager.mockImplementation(() => mockEM);

  const options: DriverRepositoryBaseOptions<TestEntity> = {
    target: TestEntity,
    executor,
    queryBuilderFactory,
    namespace: null,
    logger,
    driver: "postgres",
    driverLabel: "PostgresRepository",
    repositoryFactory,
    emitEntity: overrides.emitEntity,
  };

  const repo = new ConcreteRepository(options);

  return { repo, executor, mockEM, logger };
};

// Stable entity fixture
const entityA = Object.assign(new TestEntity(), {
  id: "entity-id-1",
  version: 1,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  name: "Entity A",
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DriverRepositoryBase", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getEntityMetadata as jest.Mock).mockReturnValue(mockMetadata);
    (buildPrimaryKeyPredicate as jest.Mock).mockImplementation((entity: any) => ({
      id: entity.id,
    }));
    (filterHiddenSelections as jest.Mock).mockReturnValue(null);
    (guardAppendOnly as jest.Mock).mockReturnValue(undefined);
    (guardDeleteDateField as jest.Mock).mockReturnValue(undefined);
    (guardExpiryDateField as jest.Mock).mockReturnValue(undefined);
    (guardUpsertBlocked as jest.Mock).mockReturnValue(undefined);
    for (const key of Object.keys(abstractMethods)) {
      (abstractMethods as any)[key] = jest.fn();
    }
  });

  // ─── Entity Handlers ────────────────────────────────────────────────

  describe("create", () => {
    test("delegates to EntityManager.create", () => {
      const { repo, mockEM } = createRepo();
      mockEM.create.mockReturnValue(entityA);

      const result = repo.create({ name: "Entity A" });

      expect(mockEM.create).toHaveBeenCalledWith({ name: "Entity A" });
      expect(result).toBe(entityA);
    });

    test("calls create with undefined when called with no options", () => {
      const { repo, mockEM } = createRepo();
      mockEM.create.mockReturnValue(entityA);

      repo.create();

      expect(mockEM.create).toHaveBeenCalledWith(undefined);
    });
  });

  describe("copy", () => {
    test("delegates to EntityManager.copy", () => {
      const { repo, mockEM } = createRepo();
      const copied = { ...entityA, id: "copy-id" } as TestEntity;
      mockEM.copy.mockReturnValue(copied);

      const result = repo.copy(entityA);

      expect(mockEM.copy).toHaveBeenCalledWith(entityA);
      expect(result).toBe(copied);
    });
  });

  describe("validate", () => {
    test("delegates to EntityManager.validate", () => {
      const { repo, mockEM } = createRepo();

      repo.validate(entityA);

      expect(mockEM.validate).toHaveBeenCalledWith(entityA);
    });
  });

  // ─── Queries ────────────────────────────────────────────────────────

  describe("count", () => {
    test("delegates to executor.executeCount with criteria", async () => {
      const { repo, executor } = createRepo();
      (executor.executeCount as jest.Mock).mockResolvedValue(3);

      const result = await repo.count({ name: "foo" } as any);

      expect(executor.executeCount).toHaveBeenCalledWith({ name: "foo" }, {});
      expect(result).toBe(3);
    });

    test("passes empty predicate when called without criteria", async () => {
      const { repo, executor } = createRepo();
      (executor.executeCount as jest.Mock).mockResolvedValue(0);

      await repo.count();

      expect(executor.executeCount).toHaveBeenCalledWith({}, {});
    });
  });

  describe("exists", () => {
    test("delegates to executor.executeExists when no options provided", async () => {
      const { repo, executor } = createRepo();
      (executor.executeExists as jest.Mock).mockResolvedValue(true);

      const result = await repo.exists({ id: "1" } as any);

      expect(executor.executeExists).toHaveBeenCalledWith({ id: "1" });
      expect(result).toBe(true);
    });

    test("uses executeCount when options are provided", async () => {
      const { repo, executor } = createRepo();
      (executor.executeCount as jest.Mock).mockResolvedValue(1);

      const result = await repo.exists({ id: "1" } as any, { withDeleted: true } as any);

      expect(executor.executeCount).toHaveBeenCalled();
      expect(executor.executeExists).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    test("returns false when executeExists returns false", async () => {
      const { repo, executor } = createRepo();
      (executor.executeExists as jest.Mock).mockResolvedValue(false);

      const result = await repo.exists({ id: "999" } as any);

      expect(result).toBe(false);
    });
  });

  describe("findOne", () => {
    test("calls find with limit: 1 and returns first result", async () => {
      const { repo } = createRepo();
      abstractMethods.find = jest.fn().mockResolvedValue([entityA]);
      (repo as any).find = abstractMethods.find;

      const result = await repo.findOne({ id: "entity-id-1" } as any);

      expect(abstractMethods.find).toHaveBeenCalledWith(
        { id: "entity-id-1" },
        expect.objectContaining({ limit: 1 }),
        "single",
      );
      expect(result).toBe(entityA);
    });

    test("returns null when find returns empty array", async () => {
      const { repo } = createRepo();
      abstractMethods.find = jest.fn().mockResolvedValue([]);
      (repo as any).find = abstractMethods.find;

      const result = await repo.findOne({ id: "missing" } as any);

      expect(result).toBeNull();
    });

    test("passes filterHiddenSelections result as select option", async () => {
      const { repo } = createRepo();
      (filterHiddenSelections as jest.Mock).mockReturnValue(["id", "name"]);
      abstractMethods.find = jest.fn().mockResolvedValue([entityA]);
      (repo as any).find = abstractMethods.find;

      await repo.findOne({ id: "1" } as any);

      expect(abstractMethods.find).toHaveBeenCalledWith(
        { id: "1" },
        expect.objectContaining({ select: ["id", "name"], limit: 1 }),
        "single",
      );
    });
  });

  describe("findOneOrFail", () => {
    test("returns entity when found", async () => {
      const { repo } = createRepo();
      abstractMethods.find = jest.fn().mockResolvedValue([entityA]);
      (repo as any).find = abstractMethods.find;

      const result = await repo.findOneOrFail({ id: "entity-id-1" } as any);

      expect(result).toBe(entityA);
    });

    test("throws ProteusRepositoryError when entity not found", async () => {
      const { repo } = createRepo();
      abstractMethods.find = jest.fn().mockResolvedValue([]);
      (repo as any).find = abstractMethods.find;

      await expect(repo.findOneOrFail({ id: "missing" } as any)).rejects.toThrow(
        ProteusRepositoryError,
      );
    });

    test("error message includes entity name", async () => {
      const { repo } = createRepo();
      abstractMethods.find = jest.fn().mockResolvedValue([]);
      (repo as any).find = abstractMethods.find;

      await expect(repo.findOneOrFail({ id: "missing" } as any)).rejects.toThrow(
        /Entity "TestEntity" not found/,
      );
    });
  });

  describe("findAndCount", () => {
    test("runs find and count in parallel", async () => {
      const { repo, executor } = createRepo();
      abstractMethods.find = jest.fn().mockResolvedValue([entityA]);
      (repo as any).find = abstractMethods.find;
      (executor.executeCount as jest.Mock).mockResolvedValue(1);

      const result = await repo.findAndCount({ name: "Entity A" } as any);

      expect(result[0]).toEqual([entityA]);
      expect(result[1]).toBe(1);
    });

    test("strips limit and offset from count options", async () => {
      const { repo, executor } = createRepo();
      abstractMethods.find = jest.fn().mockResolvedValue([]);
      (repo as any).find = abstractMethods.find;
      (executor.executeCount as jest.Mock).mockResolvedValue(0);

      await repo.findAndCount(undefined, {
        limit: 10,
        offset: 5,
        order: { name: "ASC" },
      } as any);

      // count call should not have limit/offset
      const countArgs = (executor.executeCount as jest.Mock).mock.calls[0][1];
      expect(countArgs).not.toHaveProperty("limit");
      expect(countArgs).not.toHaveProperty("offset");
    });
  });

  describe("findOneOrSave", () => {
    test("returns existing entity when found", async () => {
      const { repo } = createRepo();
      abstractMethods.find = jest.fn().mockResolvedValue([entityA]);
      (repo as any).find = abstractMethods.find;
      abstractMethods.insertOne = jest.fn();
      (repo as any).insertOne = abstractMethods.insertOne;

      const result = await repo.findOneOrSave({ id: "entity-id-1" } as any, entityA);

      expect(result).toBe(entityA);
      expect(abstractMethods.insertOne).not.toHaveBeenCalled();
    });

    test("saves and returns new entity when not found", async () => {
      const { repo, mockEM } = createRepo();
      abstractMethods.find = jest.fn().mockResolvedValue([]);
      (repo as any).find = abstractMethods.find;
      const savedEntity = { ...entityA, id: "new-id" } as TestEntity;
      abstractMethods.insertOne = jest.fn().mockResolvedValue(savedEntity);
      (repo as any).insertOne = abstractMethods.insertOne;
      mockEM.getSaveStrategy.mockReturnValue("insert");
      mockEM.create.mockReturnValue(entityA);

      const result = await repo.findOneOrSave({ id: "new-id" } as any, entityA);

      expect(result).toBe(savedEntity);
    });
  });

  // ─── findPaginated ──────────────────────────────────────────────────

  describe("findPaginated", () => {
    test("returns correct result with default page and pageSize", async () => {
      const { repo, executor } = createRepo();
      const entities = [
        entityA,
        { ...entityA, id: "id-2" },
        { ...entityA, id: "id-3" },
      ] as Array<TestEntity>;
      abstractMethods.find = jest.fn().mockResolvedValue(entities);
      (repo as any).find = abstractMethods.find;
      (executor.executeCount as jest.Mock).mockResolvedValue(10);

      const result = await repo.findPaginated();

      expect(result).toMatchSnapshot();
    });

    test("uses custom page and pageSize", async () => {
      const { repo, executor } = createRepo();
      const entities = [entityA, { ...entityA, id: "id-2" }] as Array<TestEntity>;
      abstractMethods.find = jest.fn().mockResolvedValue(entities);
      (repo as any).find = abstractMethods.find;
      (executor.executeCount as jest.Mock).mockResolvedValue(12);

      const result = await repo.findPaginated(undefined, { page: 2, pageSize: 5 });

      expect(result).toMatchSnapshot();
    });

    test("hasMore is true when more pages exist", async () => {
      const { repo, executor } = createRepo();
      abstractMethods.find = jest
        .fn()
        .mockResolvedValue([entityA, { ...entityA, id: "id-2" }]);
      (repo as any).find = abstractMethods.find;
      (executor.executeCount as jest.Mock).mockResolvedValue(5);

      const result = await repo.findPaginated(undefined, { page: 1, pageSize: 2 });

      expect(result.hasMore).toBe(true);
    });

    test("hasMore is false on last page", async () => {
      const { repo, executor } = createRepo();
      abstractMethods.find = jest.fn().mockResolvedValue([entityA]);
      (repo as any).find = abstractMethods.find;
      (executor.executeCount as jest.Mock).mockResolvedValue(5);

      const result = await repo.findPaginated(undefined, { page: 3, pageSize: 2 });

      expect(result.hasMore).toBe(false);
    });

    test("hasMore is false on exact boundary", async () => {
      const { repo, executor } = createRepo();
      abstractMethods.find = jest
        .fn()
        .mockResolvedValue([entityA, { ...entityA, id: "id-2" }]);
      (repo as any).find = abstractMethods.find;
      (executor.executeCount as jest.Mock).mockResolvedValue(4);

      const result = await repo.findPaginated(undefined, { page: 2, pageSize: 2 });

      expect(result.hasMore).toBe(false);
    });

    test("computes totalPages correctly with non-even division", async () => {
      const { repo, executor } = createRepo();
      abstractMethods.find = jest
        .fn()
        .mockResolvedValue([
          entityA,
          { ...entityA, id: "id-2" },
          { ...entityA, id: "id-3" },
        ]);
      (repo as any).find = abstractMethods.find;
      (executor.executeCount as jest.Mock).mockResolvedValue(7);

      const result = await repo.findPaginated(undefined, { page: 1, pageSize: 3 });

      expect(result.totalPages).toBe(3);
    });

    test("returns correct result for empty dataset", async () => {
      const { repo, executor } = createRepo();
      abstractMethods.find = jest.fn().mockResolvedValue([]);
      (repo as any).find = abstractMethods.find;
      (executor.executeCount as jest.Mock).mockResolvedValue(0);

      const result = await repo.findPaginated();

      expect(result).toMatchSnapshot();
    });

    test("passes criteria through to find and count", async () => {
      const { repo, executor } = createRepo();
      abstractMethods.find = jest.fn().mockResolvedValue([entityA]);
      (repo as any).find = abstractMethods.find;
      (executor.executeCount as jest.Mock).mockResolvedValue(1);

      await repo.findPaginated({ name: "test" } as any);

      const findCriteria = abstractMethods.find.mock.calls[0][0];
      expect(findCriteria).toEqual({ name: "test" });

      const countCriteria = (executor.executeCount as jest.Mock).mock.calls[0][0];
      expect(countCriteria).toEqual({ name: "test" });
    });

    test("passes other options through to findAndCount", async () => {
      const { repo, executor } = createRepo();
      abstractMethods.find = jest.fn().mockResolvedValue([entityA]);
      (repo as any).find = abstractMethods.find;
      (executor.executeCount as jest.Mock).mockResolvedValue(1);

      await repo.findPaginated(undefined, {
        page: 2,
        pageSize: 5,
        order: { name: "ASC" },
      } as any);

      // find should receive limit/offset derived from page/pageSize, plus order
      const findOptions = abstractMethods.find.mock.calls[0][1];
      expect(findOptions).toHaveProperty("order", { name: "ASC" });
      expect(findOptions).toHaveProperty("limit", 5);
      expect(findOptions).toHaveProperty("offset", 5); // (2-1)*5
      expect(findOptions).not.toHaveProperty("page");
      expect(findOptions).not.toHaveProperty("pageSize");

      // count should not have limit/offset
      const countOptions = (executor.executeCount as jest.Mock).mock.calls[0][1];
      expect(countOptions).not.toHaveProperty("limit");
      expect(countOptions).not.toHaveProperty("offset");
    });

    test("throws when page < 1", async () => {
      const { repo } = createRepo();

      await expect(repo.findPaginated(undefined, { page: 0 } as any)).rejects.toThrow(
        ProteusRepositoryError,
      );
    });

    test("throws when pageSize < 1", async () => {
      const { repo } = createRepo();

      await expect(repo.findPaginated(undefined, { pageSize: 0 } as any)).rejects.toThrow(
        ProteusRepositoryError,
      );
    });
  });

  // ─── Insert ─────────────────────────────────────────────────────────

  describe("insert", () => {
    test("single entity routes to insertOne with 'insert' hookKind", async () => {
      const { repo } = createRepo();
      abstractMethods.insertOne = jest.fn().mockResolvedValue(entityA);
      (repo as any).insertOne = abstractMethods.insertOne;

      await repo.insert(entityA);

      expect(abstractMethods.insertOne).toHaveBeenCalledWith(entityA, "insert");
    });

    test("array routes to insertBulk", async () => {
      const { repo } = createRepo();
      const entityB = { ...entityA, id: "id-2" } as TestEntity;
      abstractMethods.insertBulk = jest.fn().mockResolvedValue([entityA, entityB]);
      (repo as any).insertBulk = abstractMethods.insertBulk;

      await repo.insert([entityA, entityB]);

      expect(abstractMethods.insertBulk).toHaveBeenCalledWith([entityA, entityB]);
    });
  });

  // ─── Update ─────────────────────────────────────────────────────────

  describe("update", () => {
    test("single entity routes to updateOne with 'update' hookKind", async () => {
      const { repo } = createRepo();
      abstractMethods.updateOne = jest.fn().mockResolvedValue(entityA);
      (repo as any).updateOne = abstractMethods.updateOne;

      await repo.update(entityA);

      expect(abstractMethods.updateOne).toHaveBeenCalledWith(entityA, "update");
    });

    test("array calls updateOne for each entity sequentially", async () => {
      const { repo } = createRepo();
      const entityB = { ...entityA, id: "id-2" } as TestEntity;
      abstractMethods.updateOne = jest.fn().mockResolvedValue(entityA);
      (repo as any).updateOne = abstractMethods.updateOne;

      await repo.update([entityA, entityB]);

      expect(abstractMethods.updateOne).toHaveBeenCalledTimes(2);
    });

    test("calls guardAppendOnly with metadata and 'update'", async () => {
      const { repo } = createRepo();
      abstractMethods.updateOne = jest.fn().mockResolvedValue(entityA);
      (repo as any).updateOne = abstractMethods.updateOne;

      await repo.update(entityA);

      expect(guardAppendOnly).toHaveBeenCalledWith(mockMetadata, "update");
    });
  });

  // ─── Save (appendOnly inline guard) ─────────────────────────────────

  describe("save — appendOnly guard", () => {
    test("throws ProteusRepositoryError when metadata.appendOnly is true", async () => {
      const appendOnlyMeta = { ...mockMetadata, appendOnly: true } as any;
      const { repo } = createRepo({ metadata: appendOnlyMeta });

      await expect(repo.save(entityA)).rejects.toThrow(ProteusRepositoryError);
    });

    test("error message includes entity name and suggests insert()", async () => {
      const appendOnlyMeta = { ...mockMetadata, appendOnly: true } as any;
      const { repo } = createRepo({ metadata: appendOnlyMeta });

      await expect(repo.save(entityA)).rejects.toThrow(
        /Cannot save an append-only entity "TestEntity" — use insert\(\) instead/,
      );
    });
  });

  // ─── Clone ──────────────────────────────────────────────────────────

  describe("clone", () => {
    test("single entity routes to cloneOne", async () => {
      const { repo } = createRepo();
      const cloned = { ...entityA, id: "clone-id" } as TestEntity;
      abstractMethods.cloneOne = jest.fn().mockResolvedValue(cloned);
      (repo as any).cloneOne = abstractMethods.cloneOne;

      const result = await repo.clone(entityA);

      expect(abstractMethods.cloneOne).toHaveBeenCalledWith(entityA);
      expect(result).toBe(cloned);
    });

    test("array calls cloneOne for each entity", async () => {
      const { repo } = createRepo();
      abstractMethods.cloneOne = jest.fn().mockResolvedValue(entityA);
      (repo as any).cloneOne = abstractMethods.cloneOne;
      const entityB = { ...entityA, id: "id-2" } as TestEntity;

      await repo.clone([entityA, entityB]);

      expect(abstractMethods.cloneOne).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Destroy ────────────────────────────────────────────────────────

  describe("destroy", () => {
    test("single entity routes to destroyOne", async () => {
      const { repo } = createRepo();
      abstractMethods.destroyOne = jest.fn().mockResolvedValue(undefined);
      (repo as any).destroyOne = abstractMethods.destroyOne;

      await repo.destroy(entityA);

      expect(abstractMethods.destroyOne).toHaveBeenCalledWith(entityA);
    });

    test("array calls destroyOne for each entity", async () => {
      const { repo } = createRepo();
      abstractMethods.destroyOne = jest.fn().mockResolvedValue(undefined);
      (repo as any).destroyOne = abstractMethods.destroyOne;
      const entityB = { ...entityA, id: "id-2" } as TestEntity;

      await repo.destroy([entityA, entityB]);

      expect(abstractMethods.destroyOne).toHaveBeenCalledTimes(2);
    });

    test("calls guardAppendOnly with metadata and 'destroy'", async () => {
      const { repo } = createRepo();
      abstractMethods.destroyOne = jest.fn().mockResolvedValue(undefined);
      (repo as any).destroyOne = abstractMethods.destroyOne;

      await repo.destroy(entityA);

      expect(guardAppendOnly).toHaveBeenCalledWith(mockMetadata, "destroy");
    });
  });

  // ─── Increment / Decrement ───────────────────────────────────────────

  describe("increment", () => {
    test("delegates to executor.executeIncrement", async () => {
      const { repo, executor } = createRepo();
      (executor.executeIncrement as jest.Mock).mockResolvedValue(undefined);

      await repo.increment({ id: "1" } as any, "version" as keyof TestEntity, 1);

      expect(executor.executeIncrement).toHaveBeenCalledWith({ id: "1" }, "version", 1);
    });

    test("calls guardAppendOnly with metadata and 'increment'", async () => {
      const { repo, executor } = createRepo();
      (executor.executeIncrement as jest.Mock).mockResolvedValue(undefined);

      await repo.increment({ id: "1" } as any, "version" as keyof TestEntity, 1);

      expect(guardAppendOnly).toHaveBeenCalledWith(mockMetadata, "increment");
    });
  });

  describe("decrement", () => {
    test("delegates to executor.executeDecrement", async () => {
      const { repo, executor } = createRepo();
      (executor.executeDecrement as jest.Mock).mockResolvedValue(undefined);

      await repo.decrement({ id: "1" } as any, "version" as keyof TestEntity, 2);

      expect(executor.executeDecrement).toHaveBeenCalledWith({ id: "1" }, "version", 2);
    });

    test("calls guardAppendOnly with metadata and 'decrement'", async () => {
      const { repo, executor } = createRepo();
      (executor.executeDecrement as jest.Mock).mockResolvedValue(undefined);

      await repo.decrement({ id: "1" } as any, "version" as keyof TestEntity, 2);

      expect(guardAppendOnly).toHaveBeenCalledWith(mockMetadata, "decrement");
    });
  });

  // ─── Delete / UpdateMany ─────────────────────────────────────────────

  describe("delete", () => {
    test("delegates to executor.executeDelete", async () => {
      const { repo, executor } = createRepo();
      (executor.executeDelete as jest.Mock).mockResolvedValue(undefined);

      await repo.delete({ id: "1" } as any);

      expect(executor.executeDelete).toHaveBeenCalledWith({ id: "1" }, undefined);
    });

    test("calls guardAppendOnly with metadata and 'delete'", async () => {
      const { repo, executor } = createRepo();
      (executor.executeDelete as jest.Mock).mockResolvedValue(undefined);

      await repo.delete({ id: "1" } as any);

      expect(guardAppendOnly).toHaveBeenCalledWith(mockMetadata, "delete");
    });
  });

  describe("updateMany", () => {
    test("delegates to executor.executeUpdateMany when not versioned", async () => {
      const { repo, executor, mockEM } = createRepo();
      mockEM.updateStrategy = "update";
      (executor.executeUpdateMany as jest.Mock).mockResolvedValue(1);

      await repo.updateMany({ name: "foo" } as any, { name: "bar" });

      expect(executor.executeUpdateMany).toHaveBeenCalledWith(
        { name: "foo" },
        { name: "bar" },
      );
    });

    test("throws ProteusRepositoryError when updateStrategy is 'version'", async () => {
      const { repo, mockEM } = createRepo();
      mockEM.updateStrategy = "version";

      await expect(
        repo.updateMany({ name: "foo" } as any, { name: "bar" }),
      ).rejects.toThrow(ProteusRepositoryError);
    });

    test("calls guardAppendOnly with metadata and 'updateMany'", async () => {
      const { repo, executor, mockEM } = createRepo();
      mockEM.updateStrategy = "update";
      (executor.executeUpdateMany as jest.Mock).mockResolvedValue(1);

      await repo.updateMany({ name: "foo" } as any, { name: "bar" });

      expect(guardAppendOnly).toHaveBeenCalledWith(mockMetadata, "updateMany");
    });
  });

  // ─── Soft Destroy / Soft Delete / Restore ────────────────────────────

  describe("softDestroy", () => {
    test("calls guardDeleteDateField before performing soft destroy", async () => {
      const { repo } = createRepo({ metadata: mockMetadataWithDeleteDate });
      abstractMethods.softDestroyOne = jest.fn().mockResolvedValue(undefined);
      (repo as any).softDestroyOne = abstractMethods.softDestroyOne;

      await repo.softDestroy(entityA);

      expect(guardDeleteDateField).toHaveBeenCalled();
      expect(abstractMethods.softDestroyOne).toHaveBeenCalledWith(entityA);
    });

    test("array calls softDestroyOne for each entity", async () => {
      const { repo } = createRepo({ metadata: mockMetadataWithDeleteDate });
      abstractMethods.softDestroyOne = jest.fn().mockResolvedValue(undefined);
      (repo as any).softDestroyOne = abstractMethods.softDestroyOne;
      const entityB = { ...entityA, id: "id-2" } as TestEntity;

      await repo.softDestroy([entityA, entityB]);

      expect(abstractMethods.softDestroyOne).toHaveBeenCalledTimes(2);
    });

    test("calls guardAppendOnly with metadata and 'softDestroy'", async () => {
      const { repo } = createRepo({ metadata: mockMetadataWithDeleteDate });
      abstractMethods.softDestroyOne = jest.fn().mockResolvedValue(undefined);
      (repo as any).softDestroyOne = abstractMethods.softDestroyOne;

      await repo.softDestroy(entityA);

      expect(guardAppendOnly).toHaveBeenCalledWith(
        mockMetadataWithDeleteDate,
        "softDestroy",
      );
    });
  });

  describe("softDelete", () => {
    test("calls guardDeleteDateField and executor.executeSoftDelete", async () => {
      const { repo, executor } = createRepo({ metadata: mockMetadataWithDeleteDate });
      (executor.executeSoftDelete as jest.Mock).mockResolvedValue(undefined);

      await repo.softDelete({ id: "1" } as any);

      expect(guardDeleteDateField).toHaveBeenCalled();
      expect(executor.executeSoftDelete).toHaveBeenCalledWith({ id: "1" });
    });

    test("calls guardAppendOnly with metadata and 'softDelete'", async () => {
      const { repo, executor } = createRepo({ metadata: mockMetadataWithDeleteDate });
      (executor.executeSoftDelete as jest.Mock).mockResolvedValue(undefined);

      await repo.softDelete({ id: "1" } as any);

      expect(guardAppendOnly).toHaveBeenCalledWith(
        mockMetadataWithDeleteDate,
        "softDelete",
      );
    });
  });

  describe("restore", () => {
    test("calls guardDeleteDateField and executor.executeRestore", async () => {
      const { repo, executor } = createRepo({ metadata: mockMetadataWithDeleteDate });
      (executor.executeRestore as jest.Mock).mockResolvedValue(undefined);

      await repo.restore({ id: "1" } as any);

      expect(guardDeleteDateField).toHaveBeenCalled();
      expect(executor.executeRestore).toHaveBeenCalledWith({ id: "1" });
    });

    test("calls guardAppendOnly with metadata and 'restore'", async () => {
      const { repo, executor } = createRepo({ metadata: mockMetadataWithDeleteDate });
      (executor.executeRestore as jest.Mock).mockResolvedValue(undefined);

      await repo.restore({ id: "1" } as any);

      expect(guardAppendOnly).toHaveBeenCalledWith(mockMetadataWithDeleteDate, "restore");
    });
  });

  // ─── TTL / Expiry ────────────────────────────────────────────────────

  describe("ttl", () => {
    test("returns TTL value from executor", async () => {
      const { repo, executor } = createRepo({ metadata: mockMetadataWithExpiryDate });
      (executor.executeTtl as jest.Mock).mockResolvedValue(120);

      const result = await repo.ttl({ id: "1" } as any);

      expect(guardExpiryDateField).toHaveBeenCalled();
      expect(result).toBe(120);
    });

    test("throws ProteusRepositoryError when executor returns null", async () => {
      const { repo, executor } = createRepo({ metadata: mockMetadataWithExpiryDate });
      (executor.executeTtl as jest.Mock).mockResolvedValue(null);

      await expect(repo.ttl({ id: "1" } as any)).rejects.toThrow(ProteusRepositoryError);
    });
  });

  describe("deleteExpired", () => {
    test("calls guardExpiryDateField and executor.executeDeleteExpired", async () => {
      const { repo, executor } = createRepo({ metadata: mockMetadataWithExpiryDate });
      (executor.executeDeleteExpired as jest.Mock).mockResolvedValue(undefined);

      await repo.deleteExpired();

      expect(guardExpiryDateField).toHaveBeenCalled();
      expect(executor.executeDeleteExpired).toHaveBeenCalled();
    });

    test("calls guardAppendOnly with metadata and 'deleteExpired'", async () => {
      const { repo, executor } = createRepo({ metadata: mockMetadataWithExpiryDate });
      (executor.executeDeleteExpired as jest.Mock).mockResolvedValue(undefined);

      await repo.deleteExpired();

      expect(guardAppendOnly).toHaveBeenCalledWith(
        mockMetadataWithExpiryDate,
        "deleteExpired",
      );
    });
  });

  // ─── Upsert ──────────────────────────────────────────────────────────

  describe("upsert", () => {
    test("calls guardUpsertBlocked and delegates to upsertOne for single entity", async () => {
      const { repo } = createRepo();
      abstractMethods.upsertOne = jest.fn().mockResolvedValue(entityA);
      (repo as any).upsertOne = abstractMethods.upsertOne;

      const result = await repo.upsert(entityA);

      expect(guardUpsertBlocked).toHaveBeenCalled();
      expect(abstractMethods.upsertOne).toHaveBeenCalledWith(entityA, undefined);
      expect(result).toBe(entityA);
    });

    test("calls upsertOne for each entity in an array", async () => {
      const { repo } = createRepo();
      abstractMethods.upsertOne = jest.fn().mockResolvedValue(entityA);
      (repo as any).upsertOne = abstractMethods.upsertOne;
      const entityB = { ...entityA, id: "id-2" } as TestEntity;

      await repo.upsert([entityA, entityB]);

      expect(abstractMethods.upsertOne).toHaveBeenCalledTimes(2);
    });

    test("calls guardAppendOnly with metadata and 'upsert'", async () => {
      const { repo } = createRepo();
      abstractMethods.upsertOne = jest.fn().mockResolvedValue(entityA);
      (repo as any).upsertOne = abstractMethods.upsertOne;

      await repo.upsert(entityA);

      expect(guardAppendOnly).toHaveBeenCalledWith(mockMetadata, "upsert");
    });
  });

  // ─── Aggregates ──────────────────────────────────────────────────────

  describe("sum / average / minimum / maximum", () => {
    test("sum delegates to executeAggregate with 'sum'", async () => {
      const { repo } = createRepo();
      abstractMethods.executeAggregate = jest.fn().mockResolvedValue(42);
      (repo as any).executeAggregate = abstractMethods.executeAggregate;

      const result = await repo.sum("version" as any, { id: "1" } as any);

      expect(abstractMethods.executeAggregate).toHaveBeenCalledWith("sum", "version", {
        id: "1",
      });
      expect(result).toBe(42);
    });

    test("average delegates to executeAggregate with 'avg'", async () => {
      const { repo } = createRepo();
      abstractMethods.executeAggregate = jest.fn().mockResolvedValue(5.5);
      (repo as any).executeAggregate = abstractMethods.executeAggregate;

      await repo.average("version" as any);

      expect(abstractMethods.executeAggregate).toHaveBeenCalledWith(
        "avg",
        "version",
        undefined,
      );
    });

    test("minimum delegates to executeAggregate with 'min'", async () => {
      const { repo } = createRepo();
      abstractMethods.executeAggregate = jest.fn().mockResolvedValue(1);
      (repo as any).executeAggregate = abstractMethods.executeAggregate;

      await repo.minimum("version" as any);

      expect(abstractMethods.executeAggregate).toHaveBeenCalledWith(
        "min",
        "version",
        undefined,
      );
    });

    test("maximum delegates to executeAggregate with 'max'", async () => {
      const { repo } = createRepo();
      abstractMethods.executeAggregate = jest.fn().mockResolvedValue(100);
      (repo as any).executeAggregate = abstractMethods.executeAggregate;

      await repo.maximum("version" as any);

      expect(abstractMethods.executeAggregate).toHaveBeenCalledWith(
        "max",
        "version",
        undefined,
      );
    });
  });

  // ─── QueryBuilder ─────────────────────────────────────────────────────

  describe("queryBuilder", () => {
    test("returns result of queryBuilderFactory", () => {
      const mockQB = { build: jest.fn() };
      const factory = jest.fn().mockReturnValue(mockQB);
      const logger = createMockLogger();
      const executor = createMockExecutor();
      const mockEM = createMockEntityManager();
      (getEntityMetadata as jest.Mock).mockReturnValue(mockMetadata);
      (
        EntityManager as jest.MockedClass<typeof EntityManager<TestEntity>>
      ).mockImplementation(() => mockEM);

      const repo = new ConcreteRepository({
        target: TestEntity,
        executor,
        queryBuilderFactory: factory,
        namespace: null,
        logger,
        driver: "postgres",
        driverLabel: "PostgresRepository",
        repositoryFactory,
      });

      const result = repo.queryBuilder();

      expect(factory).toHaveBeenCalled();
      expect(result).toBe(mockQB);
    });
  });

  // ─── setup ───────────────────────────────────────────────────────────

  describe("setup", () => {
    test("resolves without doing anything (no-op)", async () => {
      const { repo } = createRepo();
      await expect(repo.setup()).resolves.toBeUndefined();
    });
  });

  // ─── saveOne (protected, exposed via exposesSaveOne) ─────────────────

  describe("saveOne", () => {
    test("calls insertOne when getSaveStrategy returns insert", async () => {
      const { repo, mockEM } = createRepo();
      mockEM.getSaveStrategy.mockReturnValue("insert");
      mockEM.create.mockReturnValue(entityA);
      abstractMethods.insertOne = jest.fn().mockResolvedValue(entityA);
      (repo as any).insertOne = abstractMethods.insertOne;

      // Pass a plain object so it goes through em.create
      const result = await repo.exposeSaveOne({ name: "new" });

      expect(abstractMethods.insertOne).toHaveBeenCalledWith(entityA, "save");
      expect(result).toBe(entityA);
    });

    test("calls updateOne when getSaveStrategy returns update", async () => {
      const { repo, mockEM } = createRepo();
      mockEM.getSaveStrategy.mockReturnValue("update");
      mockEM.create.mockReturnValue(entityA);
      abstractMethods.updateOne = jest.fn().mockResolvedValue(entityA);
      (repo as any).updateOne = abstractMethods.updateOne;

      await repo.exposeSaveOne({ name: "existing" });

      expect(abstractMethods.updateOne).toHaveBeenCalledWith(entityA, "save");
    });

    test("when strategy is 'unknown' and entity exists, calls updateOne", async () => {
      const { repo, executor, mockEM } = createRepo();
      mockEM.getSaveStrategy.mockReturnValue("unknown");
      mockEM.create.mockReturnValue(entityA);
      (buildPrimaryKeyPredicate as jest.Mock).mockReturnValue({ id: "entity-id-1" });
      // saveOne calls this.exists(pk, { withDeleted: true }) — options has 1 key so
      // exists() routes through executeCount, not executeExists
      (executor.executeCount as jest.Mock).mockResolvedValue(1); // count > 0 => exists

      // Spy on the instance's updateOne method directly
      const updateOneSpy = jest.fn().mockResolvedValue(entityA);
      (repo as any).updateOne = updateOneSpy;

      await repo.exposeSaveOne({ name: "ambiguous" });

      expect(updateOneSpy).toHaveBeenCalledWith(entityA, "save");
    });

    test("when strategy is 'unknown' and entity does not exist, calls insertOne", async () => {
      const { repo, executor, mockEM } = createRepo();
      mockEM.getSaveStrategy.mockReturnValue("unknown");
      mockEM.create.mockReturnValue(entityA);
      (buildPrimaryKeyPredicate as jest.Mock).mockReturnValue({ id: "entity-id-new" });
      (executor.executeExists as jest.Mock).mockResolvedValue(false);
      abstractMethods.insertOne = jest.fn().mockResolvedValue(entityA);
      abstractMethods.isDuplicateKeyError = jest.fn().mockReturnValue(false);
      (repo as any).insertOne = abstractMethods.insertOne;
      (repo as any).isDuplicateKeyError = abstractMethods.isDuplicateKeyError;

      await repo.exposeSaveOne({ name: "new" });

      expect(abstractMethods.insertOne).toHaveBeenCalledWith(entityA, "save");
    });

    test("when strategy is 'unknown' and insertOne throws duplicate key error, falls back to updateOne", async () => {
      const { repo, executor, mockEM } = createRepo();
      mockEM.getSaveStrategy.mockReturnValue("unknown");
      mockEM.create.mockReturnValue(entityA);
      (buildPrimaryKeyPredicate as jest.Mock).mockReturnValue({ id: "entity-id-race" });
      (executor.executeExists as jest.Mock).mockResolvedValue(false);

      const dupError = new Error("duplicate key");
      abstractMethods.insertOne = jest.fn().mockRejectedValue(dupError);
      abstractMethods.isDuplicateKeyError = jest.fn().mockReturnValue(true);
      abstractMethods.updateOne = jest.fn().mockResolvedValue(entityA);
      (repo as any).insertOne = abstractMethods.insertOne;
      (repo as any).isDuplicateKeyError = abstractMethods.isDuplicateKeyError;
      (repo as any).updateOne = abstractMethods.updateOne;

      const result = await repo.exposeSaveOne({ name: "race" });

      expect(abstractMethods.updateOne).toHaveBeenCalledWith(entityA, "save");
      expect(result).toBe(entityA);
    });

    test("when strategy is 'unknown' and insertOne throws non-duplicate error, rethrows", async () => {
      const { repo, executor, mockEM } = createRepo();
      mockEM.getSaveStrategy.mockReturnValue("unknown");
      mockEM.create.mockReturnValue(entityA);
      (buildPrimaryKeyPredicate as jest.Mock).mockReturnValue({ id: "id-err" });
      (executor.executeExists as jest.Mock).mockResolvedValue(false);

      const dbError = new Error("connection lost");
      abstractMethods.insertOne = jest.fn().mockRejectedValue(dbError);
      abstractMethods.isDuplicateKeyError = jest.fn().mockReturnValue(false);
      (repo as any).insertOne = abstractMethods.insertOne;
      (repo as any).isDuplicateKeyError = abstractMethods.isDuplicateKeyError;

      await expect(repo.exposeSaveOne({ name: "err" })).rejects.toThrow(
        "connection lost",
      );
    });
  });

  // ─── fireBeforeHook / fireAfterHook ──────────────────────────────────

  describe("fireBeforeHook", () => {
    test("calls entityManager.beforeInsert for 'insert' kind", async () => {
      const { repo, mockEM } = createRepo();

      await repo.exposeFireBeforeHook("insert", entityA);

      expect(mockEM.beforeInsert).toHaveBeenCalledWith(entityA);
    });

    test("calls entityManager.beforeUpdate for 'update' kind", async () => {
      const { repo, mockEM } = createRepo();

      await repo.exposeFireBeforeHook("update", entityA);

      expect(mockEM.beforeUpdate).toHaveBeenCalledWith(entityA);
    });

    test("calls entityManager.beforeSave for 'save' kind", async () => {
      const { repo, mockEM } = createRepo();

      await repo.exposeFireBeforeHook("save", entityA);

      expect(mockEM.beforeSave).toHaveBeenCalledWith(entityA);
    });
  });

  describe("fireAfterHook", () => {
    test("calls entityManager.afterInsert for 'insert' kind", async () => {
      const { repo, mockEM } = createRepo();

      await repo.exposeFireAfterHook("insert", entityA);

      expect(mockEM.afterInsert).toHaveBeenCalledWith(entityA);
    });

    test("calls entityManager.afterUpdate for 'update' kind", async () => {
      const { repo, mockEM } = createRepo();

      await repo.exposeFireAfterHook("update", entityA);

      expect(mockEM.afterUpdate).toHaveBeenCalledWith(entityA);
    });

    test("calls entityManager.afterSave for 'save' kind", async () => {
      const { repo, mockEM } = createRepo();

      await repo.exposeFireAfterHook("save", entityA);

      expect(mockEM.afterSave).toHaveBeenCalledWith(entityA);
    });
  });

  // ─── fireSubscriber ───────────────────────────────────────────────────

  describe("fireSubscriber", () => {
    test("does not call emitEntity when event name is unknown", async () => {
      const emitEntity = jest.fn();
      const { repo } = createRepo({ emitEntity });

      await repo.exposeFireSubscriber("unknownEvent", { entity: entityA });

      expect(emitEntity).not.toHaveBeenCalled();
    });

    test("calls emitEntity with mapped event name", async () => {
      const emitEntity = jest.fn().mockResolvedValue(undefined);
      const { repo } = createRepo({ emitEntity });

      await repo.exposeFireSubscriber("afterInsert", { entity: entityA });

      expect(emitEntity).toHaveBeenCalledWith("entity:after-insert", { entity: entityA });
    });
  });

  // ─── buildSubscriberEvent ─────────────────────────────────────────────

  describe("buildSubscriberEvent", () => {
    test("returns event with entity, metadata, context, and null connection by default", () => {
      const { repo } = createRepo();

      const event = repo.exposeBuildSubscriberEvent(entityA);

      expect(event.entity).toBe(entityA);
      expect(event.metadata).toBe(mockMetadata);
      expect(event.connection).toBeNull();
      expect(event.context).toBeUndefined();
    });

    test("includes provided connection in event", () => {
      const { repo } = createRepo();
      const mockConnection = { client: "mock-client" };

      const event = repo.exposeBuildSubscriberEvent(entityA, mockConnection);

      expect(event.connection).toBe(mockConnection);
    });
  });

  // ─── transferRelations ────────────────────────────────────────────────

  describe("transferRelations", () => {
    const mockMetadataWithRelations: EntityMetadata = {
      ...mockMetadata,
      relations: [
        {
          key: "tags",
          foreignConstructor: () => TestEntity,
          foreignKey: "id",
          findKeys: null,
          joinKeys: null,
          joinTable: null,
          options: {} as any,
          orderBy: null,
          type: "OneToMany",
        },
        {
          key: "owner",
          foreignConstructor: () => TestEntity,
          foreignKey: "id",
          findKeys: null,
          joinKeys: { ownerId: "id" },
          joinTable: null,
          options: {} as any,
          orderBy: null,
          type: "ManyToOne",
        },
      ],
    };

    test("copies relation values from source to target", () => {
      const { repo } = createRepo({ metadata: mockMetadataWithRelations });
      const related = Object.assign(new TestEntity(), { id: "related-1" });
      const source = Object.assign(new TestEntity(), {
        id: "src",
        tags: [related],
        owner: related,
      });
      const target = Object.assign(new TestEntity(), { id: "tgt" });

      repo.exposeTransferRelations(source, target);

      expect((target as any).tags).toEqual([related]);
      expect((target as any).owner).toBe(related);
    });

    test("array relation on target is a shallow copy — not the same reference as source", () => {
      const { repo } = createRepo({ metadata: mockMetadataWithRelations });
      const related = Object.assign(new TestEntity(), { id: "related-1" });
      const source = Object.assign(new TestEntity(), { id: "src", tags: [related] });
      const target = Object.assign(new TestEntity(), { id: "tgt" });

      repo.exposeTransferRelations(source, target);

      // Different array reference — mutation of target's array does not affect source
      expect((target as any).tags).not.toBe((source as any).tags);
    });

    test("non-array relation is transferred by reference", () => {
      const { repo } = createRepo({ metadata: mockMetadataWithRelations });
      const related = Object.assign(new TestEntity(), { id: "related-1" });
      const source = Object.assign(new TestEntity(), { id: "src", owner: related });
      const target = Object.assign(new TestEntity(), { id: "tgt" });

      repo.exposeTransferRelations(source, target);

      expect((target as any).owner).toBe(related);
    });

    test("skips lazy relations (isLazyRelation returns true)", () => {
      const { isLazyRelation } = require("../entity/utils/lazy-relation");
      (isLazyRelation as jest.Mock).mockReturnValue(true);

      const { repo } = createRepo({ metadata: mockMetadataWithRelations });
      const lazyProxy = { __lazy: true };
      const source = Object.assign(new TestEntity(), { id: "src", owner: lazyProxy });
      const target = Object.assign(new TestEntity(), { id: "tgt" });

      repo.exposeTransferRelations(source, target);

      expect((target as any).owner).toBeUndefined();
    });

    test("skips lazy collections (isLazyCollection returns true)", () => {
      const { isLazyCollection } = require("../entity/utils/lazy-collection");
      (isLazyCollection as jest.Mock).mockReturnValue(true);

      const { repo } = createRepo({ metadata: mockMetadataWithRelations });
      const lazyProxy = { __lazyCollection: true };
      const source = Object.assign(new TestEntity(), { id: "src", tags: lazyProxy });
      const target = Object.assign(new TestEntity(), { id: "tgt" });

      repo.exposeTransferRelations(source, target);

      expect((target as any).tags).toBeUndefined();
    });
  });
});
