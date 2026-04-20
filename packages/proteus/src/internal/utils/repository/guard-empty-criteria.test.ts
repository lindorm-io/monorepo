import { guardEmptyCriteria } from "./guard-empty-criteria";
import { describe, expect, test } from "vitest";

// ─── Custom error fixtures ────────────────────────────────────────────────────

class TestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TestError";
  }
}

class AnotherError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnotherError";
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("guardEmptyCriteria", () => {
  // ─── Non-empty criteria (happy path) ─────────────────────────────────

  describe("non-empty criteria (no throw)", () => {
    test("does not throw when criteria has one key", () => {
      expect(() => guardEmptyCriteria({ id: "abc" }, "delete", TestError)).not.toThrow();
    });

    test("does not throw when criteria has multiple keys", () => {
      expect(() =>
        guardEmptyCriteria({ id: "abc", name: "foo" }, "delete", TestError),
      ).not.toThrow();
    });

    test("does not throw when criteria value is null", () => {
      expect(() =>
        guardEmptyCriteria({ deletedAt: null }, "restore", TestError),
      ).not.toThrow();
    });

    test("does not throw when criteria value is undefined", () => {
      expect(() =>
        guardEmptyCriteria({ name: undefined }, "find", TestError),
      ).not.toThrow();
    });

    test("does not throw when criteria value is false", () => {
      expect(() =>
        guardEmptyCriteria({ active: false }, "update", TestError),
      ).not.toThrow();
    });

    test("does not throw when criteria value is 0", () => {
      expect(() =>
        guardEmptyCriteria({ count: 0 }, "updateMany", TestError),
      ).not.toThrow();
    });

    test("does not throw when criteria value is empty string", () => {
      expect(() => guardEmptyCriteria({ name: "" }, "find", TestError)).not.toThrow();
    });

    test("does not throw when criteria value is empty array", () => {
      expect(() => guardEmptyCriteria({ ids: [] }, "delete", TestError)).not.toThrow();
    });
  });

  // ─── Empty criteria (throws) ──────────────────────────────────────────

  describe("empty criteria (throws)", () => {
    test("throws the provided ErrorClass when criteria is empty object", () => {
      expect(() => guardEmptyCriteria({}, "delete", TestError)).toThrow(TestError);
    });

    test("throws the correct ErrorClass when AnotherError is provided", () => {
      expect(() => guardEmptyCriteria({}, "restore", AnotherError)).toThrow(AnotherError);
    });

    test("error message includes the operation name", () => {
      expect(() => guardEmptyCriteria({}, "softDelete", TestError)).toThrow(
        "softDelete requires non-empty criteria",
      );
    });

    test("error message includes operation for delete", () => {
      expect(() => guardEmptyCriteria({}, "delete", TestError)).toThrow(
        "delete requires non-empty criteria",
      );
    });

    test("error message includes operation for updateMany", () => {
      expect(() => guardEmptyCriteria({}, "updateMany", TestError)).toThrow(
        "updateMany requires non-empty criteria",
      );
    });

    test("error message snapshot", () => {
      let caught: Error | undefined;
      try {
        guardEmptyCriteria({}, "deleteAll", TestError);
      } catch (e) {
        caught = e as Error;
      }
      expect(caught).toBeDefined();
      expect(caught!.message).toMatchSnapshot();
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────

  describe("edge cases", () => {
    test("uses Object.keys to determine emptiness — prototype properties are ignored", () => {
      // An object that inherits a property via prototype should still be considered empty
      const inheritedObj = Object.create({ inherited: "value" }) as Record<
        string,
        unknown
      >;
      expect(() => guardEmptyCriteria(inheritedObj, "delete", TestError)).toThrow(
        TestError,
      );
    });

    test("does not throw for object with Symbol key (Symbol keys are not counted by Object.keys)", () => {
      // Object.keys() does not include Symbol keys — but the object has own string keys = 1
      const criteria: Record<string, unknown> = {};
      criteria["normalKey"] = "value";
      expect(() => guardEmptyCriteria(criteria, "find", TestError)).not.toThrow();
    });
  });
});
