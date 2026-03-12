import { LazyRelation, isLazyRelation, LAZY_RELATION } from "./lazy-relation";

describe("LazyRelation", () => {
  const createEntity = () => ({ id: "1", name: "Test", author: undefined as any });

  describe("then", () => {
    it("should load on first await and self-replace", async () => {
      const loaded = { id: "2", name: "Author" } as any;
      const loader = jest.fn().mockResolvedValue(loaded);
      const entity = createEntity();

      entity.author = new LazyRelation(entity, "author", loader);

      const result = await entity.author;

      expect(result).toBe(loaded);
      expect(loader).toHaveBeenCalledTimes(1);
      // Self-replacement: property is now the plain value
      expect(entity.author).toBe(loaded);
    });

    it("should return cached value on second await without re-querying", async () => {
      const loaded = { id: "2", name: "Author" } as any;
      const loader = jest.fn().mockResolvedValue(loaded);
      const entity = createEntity();

      entity.author = new LazyRelation(entity, "author", loader);
      const ref = entity.author;

      await ref;

      // After self-replacement, entity.author is the plain value
      // Awaiting a plain value just resolves it
      const second = await entity.author;
      expect(second).toBe(loaded);
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it("should handle null result", async () => {
      const loader = jest.fn().mockResolvedValue(null);
      const entity = createEntity();

      entity.author = new LazyRelation(entity, "author", loader);

      const result = await entity.author;

      expect(result).toBeNull();
      expect(entity.author).toBeNull();
    });

    it("should deduplicate concurrent loads", async () => {
      let resolveLoader: (v: any) => void;
      const loader = jest.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveLoader = resolve;
        }),
      );
      const entity = createEntity();
      const ref = new LazyRelation(entity, "author", loader);
      entity.author = ref;

      const p1 = ref.then((v: any) => v);
      const p2 = ref.then((v: any) => v);

      resolveLoader!({ id: "2", name: "Author" });

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toEqual({ id: "2", name: "Author" });
      expect(r2).toEqual({ id: "2", name: "Author" });
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it("should propagate loader errors", async () => {
      const loader = jest.fn().mockRejectedValue(new Error("DB error"));
      const entity = createEntity();

      entity.author = new LazyRelation(entity, "author", loader);

      await expect(entity.author).rejects.toThrow("DB error");
    });
  });

  describe("toJSON", () => {
    it("should return undefined when unresolved", () => {
      const entity = createEntity();
      const ref = new LazyRelation(entity, "author", jest.fn());
      expect(ref.toJSON()).toBeUndefined();
    });

    it("should return the value when resolved", async () => {
      const loaded = { id: "2", name: "Author" } as any;
      const entity = createEntity();
      const ref = new LazyRelation(entity, "author", jest.fn().mockResolvedValue(loaded));
      entity.author = ref;

      await ref.then(() => {});

      expect(ref.toJSON()).toBe(loaded);
    });
  });

  describe("isLazyRelation", () => {
    it("should return true for LazyRelation instances", () => {
      const entity = createEntity();
      const ref = new LazyRelation(entity, "author", jest.fn());
      expect(isLazyRelation(ref)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isLazyRelation(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isLazyRelation(undefined)).toBe(false);
    });

    it("should return false for plain objects", () => {
      expect(isLazyRelation({ id: "1" })).toBe(false);
    });

    it("should return false for arrays", () => {
      expect(isLazyRelation([])).toBe(false);
    });

    it("should return false for real Promises", () => {
      expect(isLazyRelation(Promise.resolve(null))).toBe(false);
    });
  });

  describe("brand symbol", () => {
    it("should have the brand symbol set to true", () => {
      const entity = createEntity();
      const ref = new LazyRelation(entity, "author", jest.fn());
      expect((ref as any)[LAZY_RELATION]).toBe(true);
    });
  });

  describe("truthiness", () => {
    it("should be truthy (thenable is an object)", () => {
      const entity = createEntity();
      const ref = new LazyRelation(entity, "author", jest.fn());
      expect(!!ref).toBe(true);
    });
  });
});
