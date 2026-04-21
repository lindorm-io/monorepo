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
//
// These must appear before any imports so Jest hoists them correctly.
// We mock low-level utilities but keep EntityManager and getEntityMetadata real
// since real @Entity decorators are used below.

vi.mock("../utils/build-scan-pattern", async () => ({
  buildScanPattern: vi.fn(() => "entity:test_entity:*"),
}));

vi.mock("../utils/scan-entity-keys", () => ({
  scanEntityKeys: vi.fn(),
}));

vi.mock("../utils/redis-join-table-ops", () => ({
  createRedisJoinTableOps: vi.fn(() => ({ sync: vi.fn(), delete: vi.fn() })),
  buildForwardJoinScanPattern: vi.fn((joinTable: string) => `join:${joinTable}:*`),
  buildReverseJoinScanPattern: vi.fn((joinTable: string) => `join:${joinTable}:rev:*`),
}));

vi.mock("../utils/build-join-set-key", () => ({
  buildJoinSetKey: vi.fn(
    (joinTable: string, col: string, value: unknown) =>
      `join:${joinTable}:${col}:${String(value)}`,
  ),
  buildReverseJoinSetKey: vi.fn(
    (joinTable: string, col: string, value: unknown) =>
      `join:${joinTable}:rev:${col}:${String(value)}`,
  ),
}));

vi.mock("../../../utils/repository/build-pk-predicate", () => ({
  buildPrimaryKeyPredicate: vi.fn((entity: any) => ({ id: entity.id })),
}));

vi.mock("../../../utils/repository/repository-guards", () => ({
  guardAppendOnly: vi.fn(),
  validateRelationNames: vi.fn(),
  guardDeleteDateField: vi.fn(),
  guardExpiryDateField: vi.fn(),
  guardUpsertBlocked: vi.fn(),
}));

vi.mock("../../../utils/repository/RelationPersister", () => ({
  RelationPersister: vi.fn().mockImplementation(() => ({
    saveOwning: vi.fn().mockResolvedValue(undefined),
    saveInverse: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../../../utils/repository/build-relation-filter", () => ({
  buildRelationFilter: vi.fn(() => ({})),
}));

vi.mock("../../../utils/query/filter-hidden-selections", () => ({
  filterHiddenSelections: vi.fn(() => null),
}));

vi.mock("../../../utils/pagination/build-keyset-filter-memory", () => ({
  buildKeysetFilterMemory: vi.fn(() => () => true),
}));

vi.mock("../../../entity/utils/snapshot-store", () => ({
  getSnapshot: vi.fn(() => null),
  clearSnapshot: vi.fn(),
}));

vi.mock("../../../entity/utils/install-lazy-relations", () => ({
  installLazyRelations: vi.fn(),
}));

vi.mock("../../../entity/utils/lazy-relation", () => ({
  isLazyRelation: vi.fn(() => false),
}));

vi.mock("../../../entity/utils/lazy-collection", () => ({
  isLazyCollection: vi.fn(() => false),
}));

vi.mock("../../../utils/pagination/validate-paginate-options", () => ({
  validatePaginateOptions: vi.fn(),
}));

vi.mock("../../../utils/pagination/build-keyset-order", () => ({
  buildKeysetOrder: vi.fn(() => []),
  keysetOrderToRecord: vi.fn(() => ({})),
}));

vi.mock("../../../utils/pagination/build-keyset-predicate", () => ({
  buildKeysetPredicate: vi.fn(() => ({})),
}));

vi.mock("../../../utils/pagination/encode-cursor", () => ({
  encodeCursor: vi.fn(() => "cursor-token"),
}));

vi.mock("../../../utils/pagination/decode-cursor", () => ({
  decodeCursor: vi.fn(() => ({ values: [] })),
}));

vi.mock("../../../utils/pagination/extract-cursor-values", () => ({
  extractCursorValues: vi.fn(() => []),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { randomUUID } from "crypto";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
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
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata";

const mockedScanEntityKeys = scanEntityKeys as MockedFunction<typeof scanEntityKeys>;

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
    del: vi.fn().mockReturnThis(),
    hset: vi.fn().mockReturnThis(),
    sadd: vi.fn().mockReturnThis(),
    srem: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([[null, 1]]),
  };
  return pipeline;
};

const createMockRedisClient = () => {
  const mockPipeline = createMockPipeline();
  const client: any = {
    pipeline: vi.fn(() => mockPipeline),
    smembers: vi.fn().mockResolvedValue([]),
    sadd: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1),
  };
  return { client, mockPipeline };
};

const createMockExecutor = () => ({
  executeFind: vi.fn().mockResolvedValue([]),
  executeInsert: vi.fn().mockImplementation(async (e: any) => e),
  executeInsertBulk: vi.fn().mockResolvedValue([]),
  executeUpdate: vi.fn().mockImplementation(async (e: any) => e),
  executeUpdateMany: vi.fn().mockResolvedValue(0),
  executeDelete: vi.fn().mockResolvedValue(undefined),
  executeSoftDelete: vi.fn().mockResolvedValue(undefined),
  executeRestore: vi.fn().mockResolvedValue(undefined),
  executeDeleteExpired: vi.fn().mockResolvedValue(undefined),
  executeCount: vi.fn().mockResolvedValue(0),
  executeExists: vi.fn().mockResolvedValue(false),
  executeIncrement: vi.fn().mockResolvedValue(undefined),
  executeDecrement: vi.fn().mockResolvedValue(undefined),
  executeTtl: vi.fn().mockResolvedValue(null),
});

const createMockRepositoryFactory = () => {
  const innerRepo = {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
  };
  const factory = vi.fn().mockReturnValue(innerRepo);
  return { factory, innerRepo };
};

type RepositorySetup<E extends object> = {
  repository: IProteusRepository<E>;
  client: any;
  mockPipeline: any;
  executor: ReturnType<typeof createMockExecutor>;
  repositoryFactory: Mock;
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
    queryBuilderFactory: vi.fn().mockReturnValue({ where: vi.fn(), getMany: vi.fn() }),
    client,
    namespace: options.namespace ?? null,
    logger: createMockLogger(),
    parent: options.parent,
    repositoryFactory: factory,
    emitEntity: async () => {},
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
  vi.clearAllMocks();
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

    const fireBeforeHookSpy = vi.spyOn(repository as any, "fireBeforeHook");
    const fireAfterHookSpy = vi.spyOn(repository as any, "fireAfterHook");

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

    const fireBeforeHookSpy = vi.spyOn(repository as any, "fireBeforeHook");
    const fireAfterHookSpy = vi.spyOn(repository as any, "fireAfterHook");

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

    const fireBeforeHookSpy = vi.spyOn(repository as any, "fireBeforeHook");

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
