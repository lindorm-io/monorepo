// ─── Module Mocks ─────────────────────────────────────────────────────────────
//
// These must appear before any imports so Jest hoists them correctly.
// We mock low-level utilities but keep EntityManager and getEntityMetadata real
// since real @Entity decorators are used below.

jest.mock("../utils/build-scan-pattern", () => ({
  buildScanPattern: jest.fn(() => "entity:test_entity:*"),
}));

jest.mock("../utils/scan-entity-keys", () => ({
  scanEntityKeys: jest.fn(),
}));

jest.mock("../utils/redis-join-table-ops", () => ({
  createRedisJoinTableOps: jest.fn(() => ({ sync: jest.fn(), delete: jest.fn() })),
  buildForwardJoinScanPattern: jest.fn((joinTable: string) => `join:${joinTable}:*`),
  buildReverseJoinScanPattern: jest.fn((joinTable: string) => `join:${joinTable}:rev:*`),
}));

jest.mock("../utils/build-join-set-key", () => ({
  buildJoinSetKey: jest.fn(
    (joinTable: string, col: string, value: unknown) =>
      `join:${joinTable}:${col}:${String(value)}`,
  ),
  buildReverseJoinSetKey: jest.fn(
    (joinTable: string, col: string, value: unknown) =>
      `join:${joinTable}:rev:${col}:${String(value)}`,
  ),
}));

jest.mock("#internal/utils/repository/build-pk-predicate", () => ({
  buildPrimaryKeyPredicate: jest.fn((entity: any) => ({ id: entity.id })),
}));

jest.mock("#internal/utils/repository/repository-guards", () => ({
  guardAppendOnly: jest.fn(),
  validateRelationNames: jest.fn(),
  guardDeleteDateField: jest.fn(),
  guardExpiryDateField: jest.fn(),
  guardUpsertBlocked: jest.fn(),
}));

jest.mock("#internal/utils/repository/RelationPersister", () => ({
  RelationPersister: jest.fn().mockImplementation(() => ({
    saveOwning: jest.fn().mockResolvedValue(undefined),
    saveInverse: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("#internal/utils/repository/build-relation-filter", () => ({
  buildRelationFilter: jest.fn(() => ({})),
}));

jest.mock("#internal/utils/query/filter-hidden-selections", () => ({
  filterHiddenSelections: jest.fn(() => null),
}));

jest.mock("#internal/utils/pagination/build-keyset-filter-memory", () => ({
  buildKeysetFilterMemory: jest.fn(() => () => true),
}));

jest.mock("#internal/entity/utils/snapshot-store", () => ({
  getSnapshot: jest.fn(() => null),
  clearSnapshot: jest.fn(),
}));

jest.mock("#internal/entity/utils/install-lazy-relations", () => ({
  installLazyRelations: jest.fn(),
}));

jest.mock("#internal/entity/utils/lazy-relation", () => ({
  isLazyRelation: jest.fn(() => false),
}));

jest.mock("#internal/entity/utils/lazy-collection", () => ({
  isLazyCollection: jest.fn(() => false),
}));

jest.mock("#internal/utils/pagination/validate-paginate-options", () => ({
  validatePaginateOptions: jest.fn(),
}));

jest.mock("#internal/utils/pagination/build-keyset-order", () => ({
  buildKeysetOrder: jest.fn(() => []),
  keysetOrderToRecord: jest.fn(() => ({})),
}));

jest.mock("#internal/utils/pagination/build-keyset-predicate", () => ({
  buildKeysetPredicate: jest.fn(() => ({})),
}));

jest.mock("#internal/utils/pagination/encode-cursor", () => ({
  encodeCursor: jest.fn(() => "cursor-token"),
}));

jest.mock("#internal/utils/pagination/decode-cursor", () => ({
  decodeCursor: jest.fn(() => ({ values: [] })),
}));

jest.mock("#internal/utils/pagination/extract-cursor-values", () => ({
  extractCursorValues: jest.fn(() => []),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { randomUUID } from "crypto";
import { createMockLogger } from "@lindorm/logger";
import {
  Entity,
  Field,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  PrimaryKeyField,
  VersionField,
  CreateDateField,
  UpdateDateField,
  DeleteDateField,
} from "../../../../decorators";
import type { IProteusRepository } from "../../../../interfaces";
import { NotSupportedError } from "../../../../errors/NotSupportedError";
import { RedisDuplicateKeyError } from "../errors/RedisDuplicateKeyError";
import { RedisDriverError } from "../errors/RedisDriverError";
import { RedisCursor } from "./RedisCursor";
import { RedisRepository } from "./RedisRepository";
import { scanEntityKeys } from "../utils/scan-entity-keys";
import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";

const mockedScanEntityKeys = scanEntityKeys as jest.MockedFunction<typeof scanEntityKeys>;

// ─── Test Entities ─────────────────────────────────────────────────────────────
//
// Real @Entity-decorated classes so EntityManager works correctly.

@Entity({ name: "repo_test_item" })
class RepoItem {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;
}

@Entity({ name: "repo_test_tag" })
class RepoTag {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  label!: string;
}

@Entity({ name: "repo_soft_item" })
class RepoSoftItem {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @DeleteDateField()
  deletedAt!: Date | null;

  @Field("string")
  name!: string;
}

@Entity({ name: "repo_parent" })
class RepoParent {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  title!: string;

  @OneToMany(() => RepoChild, "parent")
  children!: RepoChild[];
}

@Entity({ name: "repo_child" })
class RepoChild {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  label!: string;

  @ManyToOne(() => RepoParent, "children")
  parent!: RepoParent | null;
}

@Entity({ name: "repo_m2m_owner" })
class RepoM2MOwner {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;

  @JoinTable()
  @ManyToMany(() => RepoM2MTarget, "owners")
  targets!: RepoM2MTarget[];
}

// Entity with manual (non-generated) PK — getSaveStrategy returns "unknown" when pk is set,
// because there are no @Generated fields to determine insert vs. update from alone.
@Entity({ name: "repo_manual_pk" })
class RepoManualPk {
  @PrimaryKey()
  @Field("string")
  id!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "repo_m2m_target" })
class RepoM2MTarget {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  label!: string;

  @ManyToMany(() => RepoM2MOwner, "targets")
  owners!: RepoM2MOwner[];
}

// ─── Mock Infrastructure Factories ────────────────────────────────────────────

const createMockPipeline = () => {
  const pipeline: any = {
    del: jest.fn().mockReturnThis(),
    hset: jest.fn().mockReturnThis(),
    sadd: jest.fn().mockReturnThis(),
    srem: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([[null, 1]]),
  };
  return pipeline;
};

const createMockRedisClient = () => {
  const mockPipeline = createMockPipeline();
  const client: any = {
    pipeline: jest.fn(() => mockPipeline),
    smembers: jest.fn().mockResolvedValue([]),
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
  };
  return { client, mockPipeline };
};

const createMockExecutor = () => ({
  executeFind: jest.fn().mockResolvedValue([]),
  executeInsert: jest.fn().mockImplementation(async (e: any) => e),
  executeInsertBulk: jest.fn().mockResolvedValue([]),
  executeUpdate: jest.fn().mockImplementation(async (e: any) => e),
  executeUpdateMany: jest.fn().mockResolvedValue(0),
  executeDelete: jest.fn().mockResolvedValue(undefined),
  executeSoftDelete: jest.fn().mockResolvedValue(undefined),
  executeRestore: jest.fn().mockResolvedValue(undefined),
  executeDeleteExpired: jest.fn().mockResolvedValue(undefined),
  executeCount: jest.fn().mockResolvedValue(0),
  executeExists: jest.fn().mockResolvedValue(false),
  executeIncrement: jest.fn().mockResolvedValue(undefined),
  executeDecrement: jest.fn().mockResolvedValue(undefined),
  executeTtl: jest.fn().mockResolvedValue(null),
});

const createMockRepositoryFactory = () => {
  const innerRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
  };
  const factory = jest.fn().mockReturnValue(innerRepo);
  return { factory, innerRepo };
};

type RepositorySetup<E extends object> = {
  repository: IProteusRepository<E>;
  client: any;
  mockPipeline: any;
  executor: ReturnType<typeof createMockExecutor>;
  repositoryFactory: jest.Mock;
  innerRepo: ReturnType<typeof createMockRepositoryFactory>["innerRepo"];
};

const createRepositoryFor = <E extends object>(
  target: new () => E,
  options: {
    namespace?: string | null;
    parent?: any;
  } = {},
): RepositorySetup<E> => {
  const { client, mockPipeline } = createMockRedisClient();
  const executor = createMockExecutor();
  const { factory, innerRepo } = createMockRepositoryFactory();

  const repository = new RedisRepository<any>({
    target,
    executor: executor as any,
    queryBuilderFactory: jest
      .fn()
      .mockReturnValue({ where: jest.fn(), getMany: jest.fn() }),
    client,
    namespace: options.namespace ?? null,
    logger: createMockLogger(),
    parent: options.parent,
    repositoryFactory: factory,
    getSubscribers: () => [],
  });

  return {
    repository,
    client,
    mockPipeline,
    executor,
    repositoryFactory: factory,
    innerRepo,
  };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Constructor ───────────────────────────────────────────────────────────────

describe("RedisRepository (constructor)", () => {
  test("constructs successfully for a simple entity", () => {
    const { repository } = createRepositoryFor(RepoItem);
    expect(repository).toBeDefined();
  });

  test("constructs successfully when entity has no relations", () => {
    const { repository } = createRepositoryFor(RepoItem);
    expect(repository).toBeDefined();
  });

  test("constructs with namespace", () => {
    const { repository } = createRepositoryFor(RepoItem, { namespace: "myapp" });
    expect(repository).toBeDefined();
  });

  test("constructs with parent (for nested repository factories)", () => {
    const { repository } = createRepositoryFor(RepoChild, { parent: RepoParent });
    expect(repository).toBeDefined();
  });

  test("constructs with ManyToMany entity (detects eager relations)", () => {
    // RepoM2MOwner has a ManyToMany relation which defaults to lazy.
    // Construction should succeed even when relations reference other entities.
    const { repository } = createRepositoryFor(RepoM2MOwner);
    expect(repository).toBeDefined();
  });
});

// ─── versions() ───────────────────────────────────────────────────────────────

describe("RedisRepository.versions", () => {
  test("throws NotSupportedError always", async () => {
    const { repository } = createRepositoryFor(RepoItem);

    await expect(repository.versions({ id: "abc" } as any)).rejects.toThrow(
      NotSupportedError,
    );
  });

  test("error message describes Redis limitation", async () => {
    const { repository } = createRepositoryFor(RepoItem);

    await expect(repository.versions({ id: "abc" } as any)).rejects.toThrow(
      "Redis driver does not support versioned entities",
    );
  });

  test("throws regardless of criteria shape", async () => {
    const { repository } = createRepositoryFor(RepoItem);

    await expect(repository.versions({} as any)).rejects.toThrow(NotSupportedError);
    await expect(repository.versions({ id: "1", name: "x" } as any)).rejects.toThrow(
      NotSupportedError,
    );
  });
});

// ─── upsertOne() via upsert() — conflictOn guard ─────────────────────────────

describe("RedisRepository.upsert (conflictOn guard)", () => {
  test("throws NotSupportedError when conflictOn has entries", async () => {
    const { repository } = createRepositoryFor(RepoItem);

    const entity = Object.assign(new RepoItem(), { id: randomUUID(), name: "test" });

    await expect(
      repository.upsert(entity as any, { conflictOn: ["name"] as any }),
    ).rejects.toThrow(NotSupportedError);
  });

  test("error message references conflictOn and suggests PK-based upsert", async () => {
    const { repository } = createRepositoryFor(RepoItem);

    const entity = Object.assign(new RepoItem(), { id: randomUUID(), name: "test" });

    await expect(
      repository.upsert(entity as any, { conflictOn: ["name"] as any }),
    ).rejects.toThrow("conflictOn");
  });

  test("does not throw when conflictOn is an empty array", async () => {
    const { repository, executor } = createRepositoryFor(RepoItem);

    executor.executeExists.mockResolvedValue(false);
    executor.executeInsert.mockImplementation(async (e: any) => e);

    const entity = Object.assign(new RepoItem(), { id: randomUUID(), name: "test" });

    await expect(
      repository.upsert(entity as any, { conflictOn: [] as any }),
    ).resolves.not.toThrow();
  });

  test("proceeds to insert when entity does not exist", async () => {
    const { repository, executor } = createRepositoryFor(RepoItem);

    executor.executeExists.mockResolvedValue(false);
    const entity = Object.assign(new RepoItem(), { id: randomUUID(), name: "fresh" });

    await repository.upsert(entity as any);

    expect(executor.executeInsert).toHaveBeenCalledTimes(1);
  });

  test("proceeds to update when entity already exists", async () => {
    const { repository, executor } = createRepositoryFor(RepoItem);

    executor.executeExists.mockResolvedValue(true);
    // No version field in RepoItem metadata for the stored entity check
    executor.executeFind.mockResolvedValue([]);
    const entity = Object.assign(new RepoItem(), { id: randomUUID(), name: "updated" });

    await repository.upsert(entity as any);

    expect(executor.executeUpdate).toHaveBeenCalledTimes(1);
  });
});

// ─── upsertOne() — lifecycle hooks (T-006) ───────────────────────────────────

describe("RedisRepository.upsertOne (lifecycle hooks)", () => {
  test("T-006a: fires beforeInsert and afterInsert hooks when entity does not exist", async () => {
    const { repository, executor } = createRepositoryFor(RepoItem);

    executor.executeExists.mockResolvedValue(false);
    executor.executeInsert.mockImplementation(async (e: any) => e);

    const fireBeforeHookSpy = jest.spyOn(repository as any, "fireBeforeHook");
    const fireAfterHookSpy = jest.spyOn(repository as any, "fireAfterHook");

    const entity = Object.assign(new RepoItem(), {
      id: randomUUID(),
      name: "new-entity",
    });
    await repository.upsert(entity as any);

    expect(fireBeforeHookSpy).toHaveBeenCalledWith("insert", expect.anything());
    expect(fireAfterHookSpy).toHaveBeenCalledWith("insert", expect.anything());
  });

  test("T-006b: fires beforeUpdate and afterUpdate hooks when entity already exists", async () => {
    const { repository, executor } = createRepositoryFor(RepoItem);

    executor.executeExists.mockResolvedValue(true);
    executor.executeFind.mockResolvedValue([]);
    executor.executeUpdate.mockImplementation(async (e: any) => e);

    const fireBeforeHookSpy = jest.spyOn(repository as any, "fireBeforeHook");
    const fireAfterHookSpy = jest.spyOn(repository as any, "fireAfterHook");

    const entity = Object.assign(new RepoItem(), {
      id: randomUUID(),
      name: "existing-entity",
    });
    await repository.upsert(entity as any);

    expect(fireBeforeHookSpy).toHaveBeenCalledWith("update", expect.anything());
    expect(fireAfterHookSpy).toHaveBeenCalledWith("update", expect.anything());
  });

  test("T-006c: does not fire update hooks on insert path", async () => {
    const { repository, executor } = createRepositoryFor(RepoItem);

    executor.executeExists.mockResolvedValue(false);
    executor.executeInsert.mockImplementation(async (e: any) => e);

    const fireBeforeHookSpy = jest.spyOn(repository as any, "fireBeforeHook");

    const entity = Object.assign(new RepoItem(), {
      id: randomUUID(),
      name: "insert-path",
    });
    await repository.upsert(entity as any);

    const updateCalls = fireBeforeHookSpy.mock.calls.filter(
      (c: any[]) => c[0] === "update",
    );
    expect(updateCalls).toHaveLength(0);
  });
});

// ─── isDuplicateKeyError() ────────────────────────────────────────────────────
//
// isDuplicateKeyError is protected. We exercise it via save() on a manual-PK
// entity (no @Generated fields) so getSaveStrategy returns "unknown", which
// triggers the exists() check → insertOne() → isDuplicateKeyError() fallback path.

describe("RedisRepository.isDuplicateKeyError", () => {
  test("RedisDuplicateKeyError fallback: save() retries via update when insert races", async () => {
    // RepoManualPk has no @Generated fields → getSaveStrategy returns "unknown"
    // saveOne() "unknown" path: executeExists → false → insertOne() → throws → isDuplicateKeyError() → updateOne()
    const { repository, executor } = createRepositoryFor(RepoManualPk);

    executor.executeExists.mockResolvedValue(false);
    executor.executeInsert.mockRejectedValueOnce(new RedisDuplicateKeyError("race"));
    executor.executeUpdate.mockImplementation(async (e: any) => e);

    const entity = Object.assign(new RepoManualPk(), {
      id: "manual-pk-1",
      name: "raced",
    });
    const result = await repository.save(entity as any);

    expect(executor.executeUpdate).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
  });

  test("non-RedisDuplicateKeyError propagates from save() without triggering update fallback", async () => {
    const { repository, executor } = createRepositoryFor(RepoManualPk);

    executor.executeExists.mockResolvedValue(false);
    executor.executeInsert.mockRejectedValueOnce(new Error("unexpected storage error"));

    const entity = Object.assign(new RepoManualPk(), { id: "err-pk-1", name: "boom" });

    await expect(repository.save(entity as any)).rejects.toThrow(
      "unexpected storage error",
    );
    expect(executor.executeUpdate).not.toHaveBeenCalled();
  });

  test("isDuplicateKeyError returns false for a generic Error", async () => {
    // Via save() path: generic Error is re-thrown, not caught as duplicate key
    const { repository, executor } = createRepositoryFor(RepoManualPk);

    executor.executeExists.mockResolvedValue(false);
    executor.executeInsert.mockRejectedValueOnce(new TypeError("type mismatch"));

    const entity = Object.assign(new RepoManualPk(), { id: "type-err-1", name: "typed" });

    await expect(repository.save(entity as any)).rejects.toThrow(TypeError);
    expect(executor.executeUpdate).not.toHaveBeenCalled();
  });
});

// ─── cursor() ─────────────────────────────────────────────────────────────────

describe("RedisRepository.cursor", () => {
  test("returns a RedisCursor instance", async () => {
    const { repository, executor } = createRepositoryFor(RepoItem);
    executor.executeFind.mockResolvedValue([]);

    const cursor = await repository.cursor();

    expect(cursor).toBeInstanceOf(RedisCursor);
    await cursor.close();
  });

  test("cursor contains entities from executor when no where clause", async () => {
    const e1 = Object.assign(new RepoItem(), { id: "c1", name: "first" });
    const e2 = Object.assign(new RepoItem(), { id: "c2", name: "second" });

    const { repository, executor } = createRepositoryFor(RepoItem);
    executor.executeFind.mockResolvedValue([e1, e2]);

    const cursor = await repository.cursor();
    const items: RepoItem[] = [];

    for await (const item of cursor) {
      items.push(item);
    }

    expect(items).toHaveLength(2);
    expect(items).toMatchSnapshot();
  });

  test("uses empty predicate when no where option provided", async () => {
    const { repository, executor } = createRepositoryFor(RepoItem);
    executor.executeFind.mockResolvedValue([]);

    await repository.cursor();

    expect(executor.executeFind).toHaveBeenCalledWith({}, expect.any(Object));
  });

  test("delegates where option to executor.executeFind", async () => {
    const { repository, executor } = createRepositoryFor(RepoItem);
    executor.executeFind.mockResolvedValue([]);

    await repository.cursor({ where: { name: "filter-me" } as any });

    expect(executor.executeFind).toHaveBeenCalledWith(
      { name: "filter-me" },
      expect.any(Object),
    );
  });

  test("passes orderBy option through as order", async () => {
    const { repository, executor } = createRepositoryFor(RepoItem);
    executor.executeFind.mockResolvedValue([]);

    await repository.cursor({ orderBy: { name: "ASC" } as any });

    expect(executor.executeFind).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ order: { name: "ASC" } }),
    );
  });

  test("passes select option through", async () => {
    const { repository, executor } = createRepositoryFor(RepoItem);
    executor.executeFind.mockResolvedValue([]);

    await repository.cursor({ select: ["id", "name"] as any });

    expect(executor.executeFind).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ select: ["id", "name"] }),
    );
  });

  test("returns an empty cursor for an entity set with no results", async () => {
    const { repository, executor } = createRepositoryFor(RepoItem);
    executor.executeFind.mockResolvedValue([]);

    const cursor = await repository.cursor();
    const first = await cursor.next();

    expect(first).toBeNull();
    await cursor.close();
  });
});

// ─── clear() — no relations ───────────────────────────────────────────────────

describe("RedisRepository.clear (no relations)", () => {
  test("scans for entity keys using buildScanPattern", async () => {
    const { repository } = createRepositoryFor(RepoItem);
    mockedScanEntityKeys.mockResolvedValue([]);

    await repository.clear();

    expect(mockedScanEntityKeys).toHaveBeenCalledTimes(1);
  });

  test("is no-op when no keys are found", async () => {
    const { repository, client } = createRepositoryFor(RepoItem);
    mockedScanEntityKeys.mockResolvedValue([]);

    await repository.clear();

    expect(client.pipeline).not.toHaveBeenCalled();
  });

  test("creates a pipeline and calls del for each found key", async () => {
    const { repository, client, mockPipeline } = createRepositoryFor(RepoItem);
    mockedScanEntityKeys.mockResolvedValue([
      "entity:repo_test_item:1",
      "entity:repo_test_item:2",
    ]);

    await repository.clear();

    expect(client.pipeline).toHaveBeenCalledTimes(1);
    expect(mockPipeline.del).toHaveBeenCalledTimes(2);
    expect(mockPipeline.exec).toHaveBeenCalledTimes(1);
  });

  test("throws RedisDriverError when pipeline exec returns null", async () => {
    const { repository, mockPipeline } = createRepositoryFor(RepoItem);
    mockedScanEntityKeys.mockResolvedValue(["entity:repo_test_item:1"]);
    mockPipeline.exec.mockResolvedValueOnce(null);

    await expect(repository.clear()).rejects.toThrow(RedisDriverError);
  });

  test("error message mentions clear() on null pipeline result", async () => {
    const { repository, mockPipeline } = createRepositoryFor(RepoItem);
    mockedScanEntityKeys.mockResolvedValue(["entity:repo_test_item:1"]);
    mockPipeline.exec.mockResolvedValueOnce(null);

    await expect(repository.clear()).rejects.toThrow(
      "Pipeline execution returned null during clear()",
    );
  });

  test("deduplicates keys via Set before passing to pipeline", async () => {
    const { repository, mockPipeline } = createRepositoryFor(RepoItem);
    mockedScanEntityKeys.mockResolvedValue([
      "entity:repo_test_item:1",
      "entity:repo_test_item:1", // duplicate
      "entity:repo_test_item:2",
    ]);

    await repository.clear();

    // Only 2 unique keys — Set deduplication applied
    expect(mockPipeline.del).toHaveBeenCalledTimes(2);
  });
});

// ─── clear() — with ManyToMany relations ──────────────────────────────────────

describe("RedisRepository.clear (with ManyToMany relations)", () => {
  test("scans for entity keys, forward join keys, and reverse join keys", async () => {
    const { repository } = createRepositoryFor(RepoM2MOwner);

    mockedScanEntityKeys
      .mockResolvedValueOnce(["entity:repo_m2m_owner:1"]) // entity keys
      .mockResolvedValueOnce(["join:m2m:forward:1"]) // forward join keys
      .mockResolvedValueOnce(["join:m2m:rev:1"]); // reverse join keys

    await repository.clear();

    // 3 SCAN calls: entity + forward + reverse for the M2M relation
    expect(mockedScanEntityKeys).toHaveBeenCalledTimes(3);
  });

  test("DELs all entity and join SET keys in a single pipeline", async () => {
    const { repository, mockPipeline } = createRepositoryFor(RepoM2MOwner);

    mockedScanEntityKeys
      .mockResolvedValueOnce(["entity:repo_m2m_owner:1"])
      .mockResolvedValueOnce(["join:m2m:forward:1"])
      .mockResolvedValueOnce(["join:m2m:rev:1"]);

    await repository.clear();

    // 3 unique keys — 3 DEL calls
    expect(mockPipeline.del).toHaveBeenCalledTimes(3);
  });

  test("is no-op when entity and all join keys are empty", async () => {
    const { repository, client } = createRepositoryFor(RepoM2MOwner);

    mockedScanEntityKeys.mockResolvedValue([]);

    await repository.clear();

    expect(client.pipeline).not.toHaveBeenCalled();
  });

  test("deduplicates across entity and join key sets", async () => {
    const { repository, mockPipeline } = createRepositoryFor(RepoM2MOwner);

    mockedScanEntityKeys
      .mockResolvedValueOnce(["shared-key", "entity:repo_m2m_owner:1"])
      .mockResolvedValueOnce(["shared-key"]) // overlap with entity key
      .mockResolvedValueOnce([]);

    await repository.clear();

    // Only 2 unique keys despite 3 raw scan results
    expect(mockPipeline.del).toHaveBeenCalledTimes(2);
  });

  test("skips scan for non-ManyToMany relations (e.g. OneToMany)", async () => {
    const { repository } = createRepositoryFor(RepoParent);

    mockedScanEntityKeys.mockResolvedValueOnce([]);

    await repository.clear();

    // Only 1 scan call for entity keys — OneToMany has no join table to scan
    expect(mockedScanEntityKeys).toHaveBeenCalledTimes(1);
  });

  test("T-013: scans with correct forward and reverse join patterns for ManyToMany", async () => {
    const { repository } = createRepositoryFor(RepoM2MOwner);

    mockedScanEntityKeys.mockResolvedValue([]);

    await repository.clear();

    // 3 SCAN calls: entity keys, then forward join pattern, then reverse join pattern
    expect(mockedScanEntityKeys).toHaveBeenCalledTimes(3);
    // The mocked buildForwardJoinScanPattern and buildReverseJoinScanPattern return
    // "join:{joinTable}:*" and "join:{joinTable}:rev:*" respectively.
    const scanCalls = mockedScanEntityKeys.mock.calls;
    expect(scanCalls[1][1]).toMatchSnapshot();
    expect(scanCalls[2][1]).toMatchSnapshot();
  });
});

// ─── M2M joinKeys and findKeys metadata invariants ────────────────────────────
//
// loadManyToManyLazy is private. We verify the metadata invariants it relies
// on via resolved metadata. In the current implementation, both owner and inverse
// sides have non-null joinKeys after resolve. The isOwner check in the source
// (`relation.joinKeys !== null`) is always true for resolved M2M relations.
// The actual owner/inverse distinction for Redis SET key routing is determined
// by how joinKeys and findKeys are composed by the resolver.

describe("RedisRepository M2M metadata invariants (used by loadManyToManyLazy)", () => {
  test("ManyToMany owner side has non-null joinKeys after resolution", () => {
    const metadata = getEntityMetadata(RepoM2MOwner);
    const ownerRelation = metadata.relations.find((r) => r.key === "targets");

    expect(ownerRelation).toBeDefined();
    expect(ownerRelation!.joinKeys).not.toBeNull();
  });

  test("ManyToMany both sides have non-null findKeys after resolution", () => {
    const ownerMeta = getEntityMetadata(RepoM2MOwner);
    const targetMeta = getEntityMetadata(RepoM2MTarget);

    const ownerRelation = ownerMeta.relations.find((r) => r.key === "targets");
    const inverseRelation = targetMeta.relations.find((r) => r.key === "owners");

    expect(ownerRelation!.findKeys).not.toBeNull();
    expect(inverseRelation!.findKeys).not.toBeNull();
  });

  test("ManyToMany both sides resolve to the same joinTable name", () => {
    const ownerMeta = getEntityMetadata(RepoM2MOwner);
    const targetMeta = getEntityMetadata(RepoM2MTarget);

    const ownerRelation = ownerMeta.relations.find((r) => r.key === "targets");
    const inverseRelation = targetMeta.relations.find((r) => r.key === "owners");

    expect(ownerRelation!.joinTable).toEqual(inverseRelation!.joinTable);
    expect(ownerRelation!.joinTable).toMatchSnapshot();
  });

  test("ManyToMany relations cross-reference each other's keys", () => {
    const ownerMeta = getEntityMetadata(RepoM2MOwner);
    const ownerRelation = ownerMeta.relations.find((r) => r.key === "targets");

    // foreignKey is the property on the foreign entity that holds the inverse relation
    expect(ownerRelation!.foreignKey).toBe("owners");
    expect(ownerRelation!.key).toBe("targets");
  });
});

// ─── find() ───────────────────────────────────────────────────────────────────

describe("RedisRepository.find", () => {
  test("delegates to executor.executeFind with provided criteria", async () => {
    const { repository, executor } = createRepositoryFor(RepoItem);
    executor.executeFind.mockResolvedValue([]);

    await repository.find({ name: "test" } as any);

    expect(executor.executeFind).toHaveBeenCalledWith(
      { name: "test" },
      expect.any(Object),
    );
  });

  test("uses empty object as criteria when none provided", async () => {
    const { repository, executor } = createRepositoryFor(RepoItem);
    executor.executeFind.mockResolvedValue([]);

    await repository.find();

    expect(executor.executeFind).toHaveBeenCalledWith({}, expect.any(Object));
  });

  test("returns entities array from executor", async () => {
    const e1 = Object.assign(new RepoItem(), { id: "1", name: "alpha" });
    const e2 = Object.assign(new RepoItem(), { id: "2", name: "beta" });

    const { repository, executor } = createRepositoryFor(RepoItem);
    executor.executeFind.mockResolvedValue([e1, e2]);

    const results = await repository.find();

    expect(results).toHaveLength(2);
    expect(results).toMatchSnapshot();
  });

  test("returns empty array when no entities match", async () => {
    const { repository, executor } = createRepositoryFor(RepoItem);
    executor.executeFind.mockResolvedValue([]);

    const results = await repository.find({ name: "ghost" } as any);

    expect(results).toEqual([]);
  });
});

// ─── find() — hidden selections ───────────────────────────────────────────────

describe("RedisRepository.find (hidden selections)", () => {
  test("passes options through when filterHiddenSelections returns null", async () => {
    // filterHiddenSelections is mocked to return null (no filtering), so
    // options flow through unchanged.
    const { repository, executor } = createRepositoryFor(RepoItem);
    executor.executeFind.mockResolvedValue([]);

    await repository.find(undefined, { limit: 5 });

    expect(executor.executeFind).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ limit: 5 }),
    );
  });
});
