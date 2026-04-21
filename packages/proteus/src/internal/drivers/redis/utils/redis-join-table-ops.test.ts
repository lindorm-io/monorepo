import type { MetaRelation } from "../../../entity/types/metadata";
import type { ScopedName } from "../../../types/types";
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type Mock,
  type MockedFunction,
} from "vitest";

// ─── Module Mocks ────────────────────────────────────────────────────────────

vi.mock("../../../entity/utils/get-join-name", async () => ({
  getJoinName: vi.fn(),
}));

vi.mock("./scan-entity-keys", () => ({
  scanEntityKeys: vi.fn(),
}));

vi.mock("../../../entity/metadata/get-entity-metadata", () => ({
  getEntityMetadata: vi.fn(),
}));

import { getJoinName } from "../../../entity/utils/get-join-name";
import { scanEntityKeys } from "./scan-entity-keys";
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata";
import { createRedisJoinTableOps } from "./redis-join-table-ops";

const mockGetJoinName = getJoinName as MockedFunction<typeof getJoinName>;
const mockScanEntityKeys = scanEntityKeys as MockedFunction<typeof scanEntityKeys>;
const mockGetEntityMetadata = getEntityMetadata as MockedFunction<
  typeof getEntityMetadata
>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

class MockForeignEntity {}

const makeScopedName = (overrides: Partial<ScopedName> = {}): ScopedName => ({
  namespace: null,
  name: "post_x_tag",
  type: "join",
  parts: ["join", "post_x_tag"],
  ...overrides,
});

const makeRelation = (overrides: Partial<MetaRelation> = {}): MetaRelation =>
  ({
    type: "ManyToMany",
    joinTable: "post_x_tag",
    findKeys: { post_id: "id" },
    joinKeys: { post_id: "id" },
    foreignKey: "posts",
    foreignConstructor: vi.fn(() => MockForeignEntity),
    ...overrides,
  }) as unknown as MetaRelation;

const makeMirror = (overrides: Partial<MetaRelation> = {}): MetaRelation =>
  ({
    type: "ManyToMany",
    joinTable: "post_x_tag",
    findKeys: { tag_id: "id" },
    joinKeys: { tag_id: "id" },
    foreignKey: "tags",
    foreignConstructor: vi.fn(() => MockForeignEntity),
    ...overrides,
  }) as unknown as MetaRelation;

// Default foreign metadata returned by getEntityMetadata for delete() path:
// has a mirror relation with findKeys so exact reverse key removal is used.
const makeForeignMetadata = () => ({
  primaryKeys: ["id"],
  entity: { name: "MockForeignEntity" },
  relations: [
    {
      key: "posts",
      type: "ManyToMany",
      findKeys: { tag_id: "id" },
      joinKeys: { tag_id: "id" },
    },
  ],
});

// ─── Mock Redis Client ──────────────────────────────────────────────────────

const createMockRedis = () => {
  const pipelineCommands: Array<{ cmd: string; args: any[] }> = [];

  const pipelineObj: Record<string, Mock> = {
    sadd: vi.fn((...args: any[]) => {
      pipelineCommands.push({ cmd: "sadd", args });
      return pipelineObj;
    }),
    srem: vi.fn((...args: any[]) => {
      pipelineCommands.push({ cmd: "srem", args });
      return pipelineObj;
    }),
    del: vi.fn((...args: any[]) => {
      pipelineCommands.push({ cmd: "del", args });
      return pipelineObj;
    }),
    exec: vi.fn().mockResolvedValue([]),
  };

  const client = {
    smembers: vi.fn().mockResolvedValue([]),
    pipeline: vi.fn(() => pipelineObj),
    del: vi.fn().mockResolvedValue(1),
  };

  return { client: client as any, pipelineObj, pipelineCommands };
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("createRedisJoinTableOps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetJoinName.mockReturnValue(makeScopedName());
    mockScanEntityKeys.mockResolvedValue([]);
    mockGetEntityMetadata.mockReturnValue(makeForeignMetadata() as any);
  });

  describe("sync", () => {
    test("adds new target PKs to forward SET and owner to reverse SETs", async () => {
      const { client, pipelineObj } = createMockRedis();
      const ops = createRedisJoinTableOps(client, null);

      const owner = { id: "post-1" };
      const related = [{ id: "tag-1" }, { id: "tag-2" }];

      await ops.sync(owner as any, related as any[], makeRelation(), makeMirror(), null);

      // Pipeline should have been called
      expect(pipelineObj.sadd).toHaveBeenCalled();
      expect(pipelineObj.exec).toHaveBeenCalled();
    });

    test("removes old members from forward and reverse SETs", async () => {
      const { client, pipelineObj } = createMockRedis();
      // Existing members in forward SET
      client.smembers.mockResolvedValue(["tag-1", "tag-2"]);

      const ops = createRedisJoinTableOps(client, null);

      // Sync with only tag-1 (tag-2 should be removed)
      await ops.sync(
        { id: "post-1" } as any,
        [{ id: "tag-1" }] as any[],
        makeRelation(),
        makeMirror(),
        null,
      );

      expect(pipelineObj.srem).toHaveBeenCalled();
      expect(pipelineObj.exec).toHaveBeenCalled();
    });

    test("no-op when existing and desired match", async () => {
      const { client, pipelineObj } = createMockRedis();
      client.smembers.mockResolvedValue(["tag-1"]);

      const ops = createRedisJoinTableOps(client, null);

      await ops.sync(
        { id: "post-1" } as any,
        [{ id: "tag-1" }] as any[],
        makeRelation(),
        makeMirror(),
        null,
      );

      // No pipeline exec since no changes needed
      expect(pipelineObj.exec).not.toHaveBeenCalled();
    });

    test("clears all when related list is empty", async () => {
      const { client, pipelineObj } = createMockRedis();
      client.smembers.mockResolvedValue(["tag-1", "tag-2"]);

      const ops = createRedisJoinTableOps(client, null);

      await ops.sync(
        { id: "post-1" } as any,
        [] as any[],
        makeRelation(),
        makeMirror(),
        null,
      );

      expect(pipelineObj.srem).toHaveBeenCalled();
      expect(pipelineObj.exec).toHaveBeenCalled();
    });

    test("returns early when ownerFindKeys is empty", async () => {
      const { client, pipelineObj } = createMockRedis();
      const ops = createRedisJoinTableOps(client, null);

      const relation = makeRelation({ findKeys: {} });

      await ops.sync(
        { id: "p1" } as any,
        [{ id: "t1" }] as any[],
        relation,
        makeMirror(),
        null,
      );

      expect(client.smembers).not.toHaveBeenCalled();
      expect(pipelineObj.exec).not.toHaveBeenCalled();
    });

    test("returns early when targetFindKeys is empty", async () => {
      const { client, pipelineObj } = createMockRedis();
      const ops = createRedisJoinTableOps(client, null);

      const mirror = makeMirror({ findKeys: {} });

      await ops.sync(
        { id: "p1" } as any,
        [{ id: "t1" }] as any[],
        makeRelation(),
        mirror,
        null,
      );

      expect(client.smembers).not.toHaveBeenCalled();
      expect(pipelineObj.exec).not.toHaveBeenCalled();
    });

    test("handles mix of additions and removals", async () => {
      const { client, pipelineObj } = createMockRedis();
      client.smembers.mockResolvedValue(["tag-1", "tag-2"]);

      const ops = createRedisJoinTableOps(client, null);

      // tag-1 stays, tag-2 removed, tag-3 added
      await ops.sync(
        { id: "post-1" } as any,
        [{ id: "tag-1" }, { id: "tag-3" }] as any[],
        makeRelation(),
        makeMirror(),
        null,
      );

      // Should have sadd for tag-3 and srem for tag-2
      expect(pipelineObj.sadd).toHaveBeenCalled();
      expect(pipelineObj.srem).toHaveBeenCalled();
      expect(pipelineObj.exec).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    test("deletes forward SET and cleans reverse SETs", async () => {
      // F-014: delete() now uses getEntityMetadata to resolve exact reverse keys
      // instead of scanning. getEntityMetadata is mocked in beforeEach to return
      // foreign metadata with a mirror relation (findKeys: { tag_id: "id" }).
      const { client, pipelineObj } = createMockRedis();
      client.smembers.mockResolvedValue(["tag-1", "tag-2"]);

      const ops = createRedisJoinTableOps(client, null);

      await ops.delete({ id: "post-1" } as any, makeRelation(), null);

      // Forward key should be deleted
      expect(pipelineObj.del).toHaveBeenCalled();
      // Owner should be removed from reverse SETs via exact keys (not SCAN)
      expect(pipelineObj.srem).toHaveBeenCalled();
      expect(pipelineObj.exec).toHaveBeenCalled();
      // getEntityMetadata resolves the mirror relation
      expect(mockGetEntityMetadata).toHaveBeenCalledTimes(1);
    });

    test("deletes forward SET even when no target members exist", async () => {
      const { client, pipelineObj } = createMockRedis();
      client.smembers.mockResolvedValue([]);

      const ops = createRedisJoinTableOps(client, null);

      await ops.delete({ id: "post-1" } as any, makeRelation(), null);

      // Should still delete the forward key
      expect(pipelineObj.del).toHaveBeenCalled();
      expect(pipelineObj.exec).toHaveBeenCalled();
    });

    test("returns early when findKeys is empty", async () => {
      const { client, pipelineObj } = createMockRedis();
      const ops = createRedisJoinTableOps(client, null);

      const relation = makeRelation({ findKeys: {} });

      await ops.delete({ id: "p1" } as any, relation, null);

      expect(client.smembers).not.toHaveBeenCalled();
      expect(pipelineObj.exec).not.toHaveBeenCalled();
    });

    test("uses exact reverse key resolution via getEntityMetadata (not SCAN)", async () => {
      // New behavior (F-014): delete() resolves the mirror relation from foreign metadata
      // and builds exact reverse SET keys — no SCAN required for clean reverse cleanup.
      const { client, pipelineObj } = createMockRedis();
      client.smembers.mockResolvedValue(["tag-1"]);

      const ops = createRedisJoinTableOps(client, null);

      await ops.delete({ id: "post-1" } as any, makeRelation(), null);

      // getEntityMetadata should have been called to resolve the mirror relation
      expect(mockGetEntityMetadata).toHaveBeenCalledTimes(1);
      // SCAN should NOT be called — exact key resolution is used instead
      expect(mockScanEntityKeys).not.toHaveBeenCalled();
      // srem should be called to remove the owner from the target's reverse SET
      expect(pipelineObj.srem).toHaveBeenCalled();
    });

    test("T-008: skips reverse key cleanup and scanEntityKeys when smembers returns empty array", async () => {
      // Optimization: when smembers returns [] there are no target members
      // to clean up reverse SETs for, so getEntityMetadata should NOT be called
      // (and scanEntityKeys should not be called either).
      const { client, pipelineObj } = createMockRedis();
      client.smembers.mockResolvedValue([]);

      const ops = createRedisJoinTableOps(client, null);

      await ops.delete({ id: "post-1" } as any, makeRelation(), null);

      // No reverse key cleanup needed when there are no target members
      expect(mockGetEntityMetadata).not.toHaveBeenCalled();
      expect(mockScanEntityKeys).not.toHaveBeenCalled();
      // Forward SET key is still deleted even when there are no members
      expect(pipelineObj.del).toHaveBeenCalled();
    });

    test("T-014: throws RedisDriverError when pipeline.exec returns null", async () => {
      const { client, pipelineObj } = createMockRedis();
      client.smembers.mockResolvedValue([]);
      pipelineObj.exec.mockResolvedValueOnce(null);

      const ops = createRedisJoinTableOps(client, null);

      const { RedisDriverError } = await import("../errors/RedisDriverError");

      await expect(
        ops.delete({ id: "post-1" } as any, makeRelation(), null),
      ).rejects.toThrow(RedisDriverError);
    });
  });
});
