import { buildKeysetFilterMemory } from "./build-keyset-filter-memory";

describe("buildKeysetFilterMemory", () => {
  describe("single column ASC forward", () => {
    const filter = buildKeysetFilterMemory(
      [{ column: "score", direction: "ASC" }],
      [50],
      false,
    );

    it("should pass rows greater than cursor", () => {
      expect(filter({ score: 60 })).toBe(true);
      expect(filter({ score: 100 })).toBe(true);
    });

    it("should reject rows equal to cursor", () => {
      expect(filter({ score: 50 })).toBe(false);
    });

    it("should reject rows less than cursor", () => {
      expect(filter({ score: 40 })).toBe(false);
      expect(filter({ score: 0 })).toBe(false);
    });
  });

  describe("single column DESC forward", () => {
    const filter = buildKeysetFilterMemory(
      [{ column: "score", direction: "DESC" }],
      [50],
      false,
    );

    it("should pass rows less than cursor", () => {
      expect(filter({ score: 40 })).toBe(true);
      expect(filter({ score: 0 })).toBe(true);
    });

    it("should reject rows equal to or greater than cursor", () => {
      expect(filter({ score: 50 })).toBe(false);
      expect(filter({ score: 60 })).toBe(false);
    });
  });

  describe("single column ASC backward", () => {
    const filter = buildKeysetFilterMemory(
      [{ column: "score", direction: "ASC" }],
      [50],
      true,
    );

    it("should pass rows less than cursor", () => {
      expect(filter({ score: 40 })).toBe(true);
      expect(filter({ score: 0 })).toBe(true);
    });

    it("should reject rows equal to or greater than cursor", () => {
      expect(filter({ score: 50 })).toBe(false);
      expect(filter({ score: 60 })).toBe(false);
    });
  });

  describe("two column mixed-direction forward", () => {
    // (a ASC, b DESC) after (c, d)
    // Pass if: (a > c) OR (a = c AND b < d)
    const filter = buildKeysetFilterMemory(
      [
        { column: "category", direction: "ASC" },
        { column: "score", direction: "DESC" },
      ],
      ["B", 50],
      false,
    );

    it("should pass when first column is greater", () => {
      expect(filter({ category: "C", score: 100 })).toBe(true);
      expect(filter({ category: "C", score: 0 })).toBe(true);
    });

    it("should pass when first column equal and second less (DESC)", () => {
      expect(filter({ category: "B", score: 40 })).toBe(true);
      expect(filter({ category: "B", score: 0 })).toBe(true);
    });

    it("should reject when first column equal and second equal", () => {
      expect(filter({ category: "B", score: 50 })).toBe(false);
    });

    it("should reject when first column equal and second greater (DESC seeks less)", () => {
      expect(filter({ category: "B", score: 60 })).toBe(false);
    });

    it("should reject when first column is less", () => {
      expect(filter({ category: "A", score: 100 })).toBe(false);
    });
  });

  describe("three column boolean expansion", () => {
    // (a ASC, b DESC, c ASC) after (x, y, z)
    // Pass if: (a > x) OR (a = x AND b < y) OR (a = x AND b = y AND c > z)
    const filter = buildKeysetFilterMemory(
      [
        { column: "group", direction: "ASC" },
        { column: "priority", direction: "DESC" },
        { column: "id", direction: "ASC" },
      ],
      ["B", 5, "m"],
      false,
    );

    it("should pass when first column differs", () => {
      expect(filter({ group: "C", priority: 1, id: "a" })).toBe(true);
    });

    it("should pass when first equal, second differs (DESC)", () => {
      expect(filter({ group: "B", priority: 3, id: "a" })).toBe(true);
    });

    it("should pass when first two equal, third differs (ASC)", () => {
      expect(filter({ group: "B", priority: 5, id: "n" })).toBe(true);
    });

    it("should reject exact match", () => {
      expect(filter({ group: "B", priority: 5, id: "m" })).toBe(false);
    });

    it("should reject when all before cursor", () => {
      expect(filter({ group: "A", priority: 10, id: "z" })).toBe(false);
    });
  });

  describe("string comparison", () => {
    const filter = buildKeysetFilterMemory(
      [{ column: "name", direction: "ASC" }],
      ["charlie"],
      false,
    );

    it("should compare strings lexicographically", () => {
      expect(filter({ name: "delta" })).toBe(true);
      expect(filter({ name: "charlie" })).toBe(false);
      expect(filter({ name: "bravo" })).toBe(false);
    });
  });

  describe("null handling", () => {
    it("should handle null row value with ASC forward (nulls last)", () => {
      const filter = buildKeysetFilterMemory(
        [{ column: "name", direction: "ASC" }],
        ["charlie"],
        false,
      );
      // null is "after" everything in ASC NULLS LAST
      expect(filter({ name: null })).toBe(true);
    });

    it("should handle null cursor value with ASC forward", () => {
      const filter = buildKeysetFilterMemory(
        [{ column: "name", direction: "ASC" }],
        [null],
        false,
      );
      // Cursor is at null (last position), nothing can be after it
      expect(filter({ name: "anything" })).toBe(false);
    });

    it("should handle both null", () => {
      const filter = buildKeysetFilterMemory(
        [{ column: "name", direction: "ASC" }],
        [null],
        false,
      );
      expect(filter({ name: null })).toBe(false);
    });
  });

  describe("empty entries", () => {
    it("should return always-true filter for empty entries", () => {
      const filter = buildKeysetFilterMemory([], [], false);
      expect(filter({ anything: "value" })).toBe(true);
    });
  });
});
