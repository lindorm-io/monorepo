import { LazyCollection, isLazyCollection, LAZY_COLLECTION } from "./lazy-collection";
import { describe, expect, it, vi } from "vitest";

describe("LazyCollection", () => {
  const createEntity = () => ({ id: "1", comments: undefined as any });

  describe("then", () => {
    it("should load on first await and self-replace", async () => {
      const items = [{ id: "a" }, { id: "b" }] as any[];
      const loader = vi.fn().mockResolvedValue(items);
      const entity = createEntity();

      entity.comments = new LazyCollection(entity, "comments", loader);

      const result = await entity.comments;

      expect(result).toBe(items);
      expect(loader).toHaveBeenCalledTimes(1);
      // Self-replacement
      expect(entity.comments).toBe(items);
      expect(Array.isArray(entity.comments)).toBe(true);
    });

    it("should return cached value on second await", async () => {
      const items = [{ id: "a" }] as any[];
      const loader = vi.fn().mockResolvedValue(items);
      const entity = createEntity();

      entity.comments = new LazyCollection(entity, "comments", loader);
      const ref = entity.comments;

      await ref;

      const second = await entity.comments;
      expect(second).toBe(items);
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it("should handle empty array result", async () => {
      const loader = vi.fn().mockResolvedValue([]);
      const entity = createEntity();

      entity.comments = new LazyCollection(entity, "comments", loader);

      const result = await entity.comments;

      expect(result).toEqual([]);
      expect(Array.isArray(entity.comments)).toBe(true);
      expect(entity.comments).toHaveLength(0);
    });

    it("should deduplicate concurrent loads", async () => {
      let resolveLoader: (v: any) => void;
      const loader = vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveLoader = resolve;
        }),
      );
      const entity = createEntity();
      const ref = new LazyCollection(entity, "comments", loader);
      entity.comments = ref;

      const p1 = ref.then((v: any) => v);
      const p2 = ref.then((v: any) => v);

      resolveLoader!([{ id: "a" }]);

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toEqual([{ id: "a" }]);
      expect(r2).toEqual([{ id: "a" }]);
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it("should propagate loader errors", async () => {
      const loader = vi.fn().mockRejectedValue(new Error("DB error"));
      const entity = createEntity();

      entity.comments = new LazyCollection(entity, "comments", loader);

      await expect(entity.comments).rejects.toThrow("DB error");
    });
  });

  describe("toJSON", () => {
    it("should return undefined when unresolved", () => {
      const entity = createEntity();
      const ref = new LazyCollection(entity, "comments", vi.fn());
      expect(ref.toJSON()).toBeUndefined();
    });

    it("should return the array when resolved", async () => {
      const items = [{ id: "a" }] as any[];
      const entity = createEntity();
      const ref = new LazyCollection(
        entity,
        "comments",
        vi.fn().mockResolvedValue(items),
      );
      entity.comments = ref;

      await ref.then(() => {});

      expect(ref.toJSON()).toBe(items);
    });
  });

  describe("isLazyCollection", () => {
    it("should return true for LazyCollection instances", () => {
      const entity = createEntity();
      const ref = new LazyCollection(entity, "comments", vi.fn());
      expect(isLazyCollection(ref)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isLazyCollection(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isLazyCollection(undefined)).toBe(false);
    });

    it("should return false for arrays", () => {
      expect(isLazyCollection([])).toBe(false);
    });

    it("should return false for plain objects", () => {
      expect(isLazyCollection({ id: "1" })).toBe(false);
    });
  });

  describe("brand symbol", () => {
    it("should have the brand symbol set to true", () => {
      const entity = createEntity();
      const ref = new LazyCollection(entity, "comments", vi.fn());
      expect((ref as any)[LAZY_COLLECTION]).toBe(true);
    });
  });
});
