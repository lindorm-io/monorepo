import { extractExactPk } from "./is-pk-exact";
import { describe, expect, test } from "vitest";

describe("extractExactPk", () => {
  describe("single PK", () => {
    test("should extract scalar string PK", () => {
      expect(extractExactPk({ id: "abc" }, ["id"])).toMatchSnapshot();
    });

    test("should extract scalar number PK", () => {
      expect(extractExactPk({ id: 42 }, ["id"])).toMatchSnapshot();
    });

    test("should return null for missing PK", () => {
      expect(extractExactPk({ name: "test" }, ["id"])).toBeNull();
    });

    test("should return null for null PK value", () => {
      expect(extractExactPk({ id: null }, ["id"])).toBeNull();
    });

    test("should return null for object PK value (operator)", () => {
      expect(extractExactPk({ id: { $gt: 5 } }, ["id"])).toBeNull();
    });

    test("should return null for array PK value", () => {
      expect(extractExactPk({ id: [1, 2, 3] }, ["id"])).toBeNull();
    });
  });

  describe("composite PK", () => {
    test("should extract all PK values in order", () => {
      const criteria = { tenantId: "t1", userId: "u1", name: "extra" };
      expect(extractExactPk(criteria, ["tenantId", "userId"])).toMatchSnapshot();
    });

    test("should return null if any PK is missing", () => {
      const criteria = { tenantId: "t1", name: "extra" };
      expect(extractExactPk(criteria, ["tenantId", "userId"])).toBeNull();
    });

    test("should return null if any PK has operator value", () => {
      const criteria = { tenantId: "t1", userId: { $in: ["u1", "u2"] } };
      expect(extractExactPk(criteria, ["tenantId", "userId"])).toBeNull();
    });
  });

  describe("edge cases", () => {
    test("should return null for null criteria", () => {
      expect(extractExactPk(null as any, ["id"])).toBeNull();
    });

    test("should return null for undefined criteria", () => {
      expect(extractExactPk(undefined as any, ["id"])).toBeNull();
    });

    test("should return null for non-object criteria", () => {
      expect(extractExactPk("not-an-object" as any, ["id"])).toBeNull();
    });

    test("should handle boolean PK value", () => {
      expect(extractExactPk({ flag: true }, ["flag"])).toMatchSnapshot();
    });

    test("should handle empty primaryKeys array", () => {
      expect(extractExactPk({ id: "abc" }, [])).toMatchSnapshot();
    });
  });
});
