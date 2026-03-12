import type { EntityMetadata, MetaRelation } from "../types/metadata";
import { hydrateRelations } from "./hydrate-relations";
import { getSnapshot } from "./snapshot-store";

const makeRelation = (overrides: Partial<MetaRelation>): MetaRelation =>
  ({
    key: "items",
    type: "OneToMany",
    joinKeys: null,
    options: { loading: { single: "eager", multiple: "eager" } },
    ...overrides,
  }) as unknown as MetaRelation;

const metadata = {
  relations: [
    makeRelation({
      key: "detail",
      type: "OneToOne",
      options: { loading: { single: "eager", multiple: "eager" } } as any,
    }),
    makeRelation({
      key: "posts",
      type: "OneToMany",
      options: { loading: { single: "eager", multiple: "eager" } } as any,
    }),
    makeRelation({
      key: "tags",
      type: "ManyToMany",
      options: { loading: { single: "ignore", multiple: "ignore" } } as any,
    }),
    makeRelation({
      key: "lazy",
      type: "ManyToOne",
      options: { loading: { single: "lazy", multiple: "lazy" } } as any,
    }),
  ],
} as unknown as EntityMetadata;

describe("hydrateRelations", () => {
  test("should assign eager relation data", () => {
    const entity = {} as any;
    const detail = { id: "d1", info: "test" };
    hydrateRelations(entity, metadata, { detail });
    expect(entity.detail).toBe(detail);
  });

  test("should set default empty array for eager collection with no data", () => {
    const entity = {} as any;
    hydrateRelations(entity, metadata, {});
    expect(entity.posts).toEqual([]);
  });

  test("should set default null for eager singular with no data", () => {
    const entity = {} as any;
    hydrateRelations(entity, metadata, {});
    expect(entity.detail).toBeNull();
  });

  test("should leave ignore relations undefined when no data provided", () => {
    const entity = {} as any;
    hydrateRelations(entity, metadata, {});
    expect(entity.tags).toBeUndefined();
  });

  test("should assign data to ignore relations when explicitly provided", () => {
    const entity = {} as any;
    const tags = [{ id: "t1" }, { id: "t2" }];
    hydrateRelations(entity, metadata, { tags });
    expect(entity.tags).toBe(tags);
  });

  test("should leave lazy relations undefined (treated as ignore)", () => {
    const entity = {} as any;
    hydrateRelations(entity, metadata, {});
    expect(entity.lazy).toBeUndefined();
  });

  test("should store snapshot for singular related entity", () => {
    const entity = {} as any;
    const detail = { id: "d1", info: "test" };
    hydrateRelations(entity, metadata, { detail });

    const snap = getSnapshot(detail);
    expect(snap).not.toBeNull();
    expect(snap!.id).toBe("d1");
  });

  test("should store snapshots for collection items", () => {
    const entity = {} as any;
    const posts = [
      { id: "p1", title: "Post 1" },
      { id: "p2", title: "Post 2" },
    ];
    hydrateRelations(entity, metadata, { posts });

    expect(getSnapshot(posts[0])).not.toBeNull();
    expect(getSnapshot(posts[1])).not.toBeNull();
  });

  test("should skip null data items in collection", () => {
    const entity = {} as any;
    const posts = [{ id: "p1", title: "Post 1" }, null];
    hydrateRelations(entity, metadata, { posts });
    expect(entity.posts).toEqual(posts);
  });
});
