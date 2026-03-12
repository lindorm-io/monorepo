// TCK: Edge Cases Suite
// Tests boundary conditions: empty results, null fields, large text, unicode.

import type { TckDriverHandle } from "./types";
import type { TckEntities } from "./create-tck-entities";

export const edgeCasesSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  describe("Edge Cases", () => {
    const { TckSimpleUser, TckSimplePost } = entities;

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("find on empty store returns empty array", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const results = await repo.find();
      expect(results).toEqual([]);
    });

    test("count on empty store returns 0", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const count = await repo.count();
      expect(count).toBe(0);
    });

    test("null fields are stored and retrieved correctly", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const entity = await repo.insert({ name: "NullTest", email: null, age: 0 });

      const found = await repo.findOne({ id: entity.id });
      expect(found!.email).toBeNull();
    });

    test("large text values are stored and retrieved correctly", async () => {
      const repo = getHandle().repository(TckSimplePost);
      const largeText = "x".repeat(10_000);
      const post = await repo.insert({ title: "LargePost", body: largeText });

      const found = await repo.findOne({ id: post.id });
      expect(found!.body).toBe(largeText);
      expect(found!.body!.length).toBe(10_000);
    });

    test("unicode values are stored and retrieved correctly", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const unicodeName = "测试用户 🎉 日本語テスト";
      const entity = await repo.insert({ name: unicodeName });

      const found = await repo.findOne({ id: entity.id });
      expect(found!.name).toBe(unicodeName);
    });

    test("empty string is distinct from null", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const withEmpty = await repo.insert({ name: "EmptyEmail", email: "" as any });
      const withNull = await repo.insert({ name: "NullEmail", email: null });

      const foundEmpty = await repo.findOne({ id: withEmpty.id });
      const foundNull = await repo.findOne({ id: withNull.id });

      // Empty string and null should be preserved as-is
      expect(foundEmpty!.email).toBe("");
      expect(foundNull!.email).toBeNull();
    });

    test("zero values are stored correctly (not treated as null/falsy)", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const entity = await repo.insert({ name: "ZeroAge", age: 0 });

      const found = await repo.findOne({ id: entity.id });
      expect(found!.age).toBe(0);
    });

    test("concurrent inserts of different entities succeed", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const promises = Array.from({ length: 5 }, (_, i) =>
        repo.insert({ name: `Concurrent${i}`, age: i }),
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);

      const ids = new Set(results.map((r) => r.id));
      expect(ids.size).toBe(5);
    });

    test("insert and immediate find returns consistent result", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const entity = await repo.insert({ name: "Consistent", age: 42 });

      const found = await repo.findOne({ id: entity.id });
      expect(found).not.toBeNull();
      expect(found!.name).toBe(entity.name);
      expect(found!.age).toBe(entity.age);
      expect(found!.version).toBe(entity.version);
    });

    test("date precision survives round-trip", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      const inserted = await repo.insert({ name: "DatePrecision" });

      const found = await repo.findOne({ id: inserted.id });
      expect(found).not.toBeNull();
      expect(found!.createdAt.getTime()).toBe(inserted.createdAt.getTime());
    });

    test("find criteria extended via Object.create does not error on prototype properties", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      await repo.insert({ name: "ProtoTest", age: 55 });

      const proto = { inheritedProp: "should-be-ignored" };
      const criteria = Object.create(proto) as { name?: string };
      criteria.name = "ProtoTest";

      const results = await repo.find(criteria);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("ProtoTest");
    });
  });
};
