import type { MetaRelation } from "../../../entity/types/metadata";
import type { MemoryStore } from "../types/memory-store";
import { createMemoryJoinTableOps } from "./memory-join-table-ops";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeStore = (): MemoryStore => ({
  tables: new Map(),
  joinTables: new Map(),
  collectionTables: new Map(),
  incrementCounters: new Map(),
});

const makeRelation = (overrides: Partial<MetaRelation> = {}): MetaRelation =>
  ({
    type: "ManyToMany",
    joinTable: "post_tag",
    findKeys: { post_id: "id" },
    joinKeys: { post_id: "id" },
    ...overrides,
  }) as unknown as MetaRelation;

const makeMirror = (overrides: Partial<MetaRelation> = {}): MetaRelation =>
  ({
    type: "ManyToMany",
    joinTable: "post_tag",
    findKeys: { tag_id: "id" },
    joinKeys: { tag_id: "id" },
    ...overrides,
  }) as unknown as MetaRelation;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("createMemoryJoinTableOps", () => {
  describe("sync", () => {
    test("inserts join rows for new relationships", async () => {
      const store = makeStore();
      const ops = createMemoryJoinTableOps(() => store);

      const owner = { id: "post-1" };
      const related1 = { id: "tag-1" };
      const related2 = { id: "tag-2" };

      await ops.sync(
        owner as any,
        [related1, related2] as any[],
        makeRelation(),
        makeMirror(),
        null,
      );

      const table = store.joinTables.get("post_tag");
      expect(table?.size).toBe(2);
      expect([...table!.values()]).toMatchSnapshot();
    });

    test("creates join table on first sync", async () => {
      const store = makeStore();
      const ops = createMemoryJoinTableOps(() => store);

      expect(store.joinTables.size).toBe(0);

      await ops.sync(
        { id: "p1" } as any,
        [{ id: "t1" }] as any[],
        makeRelation(),
        makeMirror(),
        null,
      );

      expect(store.joinTables.has("post_tag")).toBe(true);
    });

    test("uses namespaced key when namespace is provided", async () => {
      const store = makeStore();
      const ops = createMemoryJoinTableOps(() => store);

      await ops.sync(
        { id: "p1" } as any,
        [{ id: "t1" }] as any[],
        makeRelation(),
        makeMirror(),
        "myns",
      );

      expect(store.joinTables.has("myns.post_tag")).toBe(true);
      expect(store.joinTables.has("post_tag")).toBe(false);
    });

    test("removes rows no longer in related list", async () => {
      const store = makeStore();
      const ops = createMemoryJoinTableOps(() => store);

      const owner = { id: "post-1" };
      const tag1 = { id: "tag-1" };
      const tag2 = { id: "tag-2" };
      const tag3 = { id: "tag-3" };

      // Initial: two tags
      await ops.sync(
        owner as any,
        [tag1, tag2] as any[],
        makeRelation(),
        makeMirror(),
        null,
      );

      // Update: only tag1 and tag3
      await ops.sync(
        owner as any,
        [tag1, tag3] as any[],
        makeRelation(),
        makeMirror(),
        null,
      );

      const table = store.joinTables.get("post_tag");
      const rows = [...table!.values()];

      expect(rows.some((r) => r.tag_id === "tag-2")).toBe(false);
      expect(rows.some((r) => r.tag_id === "tag-1")).toBe(true);
      expect(rows.some((r) => r.tag_id === "tag-3")).toBe(true);
    });

    test("does not add duplicate rows for already-existing relationships", async () => {
      const store = makeStore();
      const ops = createMemoryJoinTableOps(() => store);

      const owner = { id: "post-1" };
      const tag1 = { id: "tag-1" };

      await ops.sync(owner as any, [tag1] as any[], makeRelation(), makeMirror(), null);
      await ops.sync(owner as any, [tag1] as any[], makeRelation(), makeMirror(), null);

      const table = store.joinTables.get("post_tag");
      expect(table?.size).toBe(1);
    });

    test("clears all join rows when related list is empty", async () => {
      const store = makeStore();
      const ops = createMemoryJoinTableOps(() => store);

      const owner = { id: "post-1" };

      await ops.sync(
        owner as any,
        [{ id: "t1" }] as any[],
        makeRelation(),
        makeMirror(),
        null,
      );
      await ops.sync(owner as any, [], makeRelation(), makeMirror(), null);

      const table = store.joinTables.get("post_tag");
      expect(table?.size).toBe(0);
    });

    test("returns early when ownerFindKeys is empty", async () => {
      const store = makeStore();
      const ops = createMemoryJoinTableOps(() => store);

      const relation = makeRelation({ findKeys: {} });
      const mirror = makeMirror();

      await expect(
        ops.sync({ id: "p1" } as any, [{ id: "t1" }] as any[], relation, mirror, null),
      ).resolves.toBeUndefined();

      // Table may have been created by resolveJoinTable, but no rows should be inserted
      const table = store.joinTables.get("post_tag");
      expect(table?.size ?? 0).toBe(0);
    });

    test("returns early when targetFindKeys is empty", async () => {
      const store = makeStore();
      const ops = createMemoryJoinTableOps(() => store);

      const relation = makeRelation();
      const mirror = makeMirror({ findKeys: {} });

      await expect(
        ops.sync({ id: "p1" } as any, [{ id: "t1" }] as any[], relation, mirror, null),
      ).resolves.toBeUndefined();

      // Table may have been created by resolveJoinTable, but no rows should be inserted
      const table = store.joinTables.get("post_tag");
      expect(table?.size ?? 0).toBe(0);
    });

    test("does not delete rows belonging to other owners", async () => {
      const store = makeStore();
      const ops = createMemoryJoinTableOps(() => store);

      const ownerA = { id: "post-a" };
      const ownerB = { id: "post-b" };
      const tag = { id: "tag-1" };

      await ops.sync(ownerA as any, [tag] as any[], makeRelation(), makeMirror(), null);
      await ops.sync(ownerB as any, [tag] as any[], makeRelation(), makeMirror(), null);

      // Clear ownerA's relationships
      await ops.sync(ownerA as any, [], makeRelation(), makeMirror(), null);

      const table = store.joinTables.get("post_tag");
      const rows = [...table!.values()];

      expect(rows.some((r) => r.post_id === "post-b")).toBe(true);
    });
  });

  describe("delete", () => {
    test("removes all join rows for the given owner entity", async () => {
      const store = makeStore();
      const ops = createMemoryJoinTableOps(() => store);

      const owner = { id: "post-1" };

      await ops.sync(
        owner as any,
        [{ id: "t1" }, { id: "t2" }] as any[],
        makeRelation(),
        makeMirror(),
        null,
      );

      await ops.delete(owner as any, makeRelation(), null);

      const table = store.joinTables.get("post_tag");
      expect(table?.size).toBe(0);
    });

    test("does not delete rows for other owners", async () => {
      const store = makeStore();
      const ops = createMemoryJoinTableOps(() => store);

      const ownerA = { id: "post-a" };
      const ownerB = { id: "post-b" };

      await ops.sync(
        ownerA as any,
        [{ id: "t1" }] as any[],
        makeRelation(),
        makeMirror(),
        null,
      );
      await ops.sync(
        ownerB as any,
        [{ id: "t2" }] as any[],
        makeRelation(),
        makeMirror(),
        null,
      );

      await ops.delete(ownerA as any, makeRelation(), null);

      const table = store.joinTables.get("post_tag");
      const rows = [...table!.values()];

      expect(rows.some((r) => r.post_id === "post-b")).toBe(true);
      expect(rows.some((r) => r.post_id === "post-a")).toBe(false);
    });

    test("no-op when relation has no findKeys", async () => {
      const store = makeStore();
      const ops = createMemoryJoinTableOps(() => store);

      const relation = makeRelation({ findKeys: {} });

      await expect(
        ops.delete({ id: "p1" } as any, relation, null),
      ).resolves.toBeUndefined();
    });

    test("no-op when join table has no matching rows", async () => {
      const store = makeStore();
      const ops = createMemoryJoinTableOps(() => store);

      // Seed with a different owner
      await ops.sync(
        { id: "other" } as any,
        [{ id: "t1" }] as any[],
        makeRelation(),
        makeMirror(),
        null,
      );

      await ops.delete({ id: "no-match" } as any, makeRelation(), null);

      const table = store.joinTables.get("post_tag");
      expect(table?.size).toBe(1);
    });
  });
});
