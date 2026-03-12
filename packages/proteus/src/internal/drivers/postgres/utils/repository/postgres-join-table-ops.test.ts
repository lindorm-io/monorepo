import type { MetaRelation } from "#internal/entity/types/metadata";
import type { PostgresQueryClient } from "../../types/postgres-query-client";
import { createPostgresJoinTableOps } from "./postgres-join-table-ops";

// Mock the underlying implementations
jest.mock("./manage-join-table", () => ({
  syncJoinTableRows: jest.fn().mockResolvedValue(undefined),
  deleteJoinTableRows: jest.fn().mockResolvedValue(undefined),
}));

import { syncJoinTableRows, deleteJoinTableRows } from "./manage-join-table";

const mockSync = syncJoinTableRows as jest.MockedFunction<typeof syncJoinTableRows>;
const mockDelete = deleteJoinTableRows as jest.MockedFunction<typeof deleteJoinTableRows>;

const makeClient = (): PostgresQueryClient => ({
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
});

const makeRelation = (overrides: Partial<MetaRelation> = {}): MetaRelation => ({
  key: "tags",
  foreignConstructor: () => class {} as any,
  foreignKey: "tagId",
  findKeys: { article_id: "id" },
  joinKeys: { article_id: "id" },
  joinTable: "articles_x_tags",
  options: {
    deferrable: false,
    initiallyDeferred: false,
    loading: { single: "lazy", multiple: "lazy" },
    nullable: true,
    onDestroy: "cascade",
    onInsert: "cascade",
    onOrphan: "ignore",
    onSoftDestroy: "ignore",
    onUpdate: "cascade",
    strategy: null,
  },
  orderBy: null,
  type: "ManyToMany",
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createPostgresJoinTableOps", () => {
  it("should return an object with sync and delete methods", () => {
    const client = makeClient();
    const ops = createPostgresJoinTableOps(client);
    expect(typeof ops.sync).toBe("function");
    expect(typeof ops.delete).toBe("function");
  });

  describe("sync", () => {
    it("should delegate to syncJoinTableRows with all arguments", async () => {
      const client = makeClient();
      const ops = createPostgresJoinTableOps(client);

      const entity = { id: "article-1" };
      const relatedEntities = [{ id: "tag-a" }, { id: "tag-b" }];
      const relation = makeRelation();
      const mirror = makeRelation({ key: "articles" });
      const namespace = "public";

      await ops.sync(entity as any, relatedEntities as any, relation, mirror, namespace);

      expect(mockSync).toHaveBeenCalledTimes(1);
      expect(mockSync).toHaveBeenCalledWith(
        entity,
        relatedEntities,
        relation,
        mirror,
        client,
        namespace,
      );
    });

    it("should pass null namespace through to syncJoinTableRows", async () => {
      const client = makeClient();
      const ops = createPostgresJoinTableOps(client);
      const relation = makeRelation();
      const mirror = makeRelation({ key: "articles" });

      await ops.sync({} as any, [] as any, relation, mirror, null);

      expect(mockSync).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        relation,
        mirror,
        client,
        null,
      );
    });

    it("should return the resolved value from syncJoinTableRows", async () => {
      const client = makeClient();
      const ops = createPostgresJoinTableOps(client);
      const relation = makeRelation();
      const mirror = makeRelation({ key: "articles" });

      const result = await ops.sync({} as any, [] as any, relation, mirror, "ns");
      expect(result).toBeUndefined();
    });
  });

  describe("delete", () => {
    it("should delegate to deleteJoinTableRows with all arguments", async () => {
      const client = makeClient();
      const ops = createPostgresJoinTableOps(client);

      const entity = { id: "article-1" };
      const relation = makeRelation();
      const namespace = "public";

      await ops.delete(entity as any, relation, namespace);

      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockDelete).toHaveBeenCalledWith(entity, relation, client, namespace);
    });

    it("should pass null namespace through to deleteJoinTableRows", async () => {
      const client = makeClient();
      const ops = createPostgresJoinTableOps(client);
      const relation = makeRelation();

      await ops.delete({} as any, relation, null);

      expect(mockDelete).toHaveBeenCalledWith(expect.anything(), relation, client, null);
    });

    it("should return the resolved value from deleteJoinTableRows", async () => {
      const client = makeClient();
      const ops = createPostgresJoinTableOps(client);
      const result = await ops.delete({} as any, makeRelation(), "public");
      expect(result).toBeUndefined();
    });
  });

  describe("client binding", () => {
    it("should bind the client at creation time, not at call time", async () => {
      const client = makeClient();
      const ops = createPostgresJoinTableOps(client);

      await ops.delete({} as any, makeRelation(), "public");

      // The captured client passed to deleteJoinTableRows should be the one from creation
      expect(mockDelete).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        client,
        expect.anything(),
      );
    });

    it("should use separate client instances for separate ops objects", async () => {
      const clientA = makeClient();
      const clientB = makeClient();
      const opsA = createPostgresJoinTableOps(clientA);
      const opsB = createPostgresJoinTableOps(clientB);
      const relation = makeRelation();

      await opsA.delete({} as any, relation, null);
      await opsB.delete({} as any, relation, null);

      expect(mockDelete.mock.calls[0][2]).toBe(clientA);
      expect(mockDelete.mock.calls[1][2]).toBe(clientB);
    });
  });
});
