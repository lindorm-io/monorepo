import { describe, expect, test } from "vitest";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError.js";
import { guardUnrestrictedCriteria } from "./guard-unrestricted-criteria.js";

describe("guardUnrestrictedCriteria", () => {
  describe("criteria that restrict (no throw)", () => {
    test.each([
      ["a bare equality", { id: "abc" }],
      ["a falsy value", { active: false }],
      ["a zero", { count: 0 }],
      ["an empty string", { name: "" }],
      ["an explicit null", { deletedAt: null }],
      ["an empty $in list", { ids: { $in: [] } }],
    ])("%s", (_label, criteria) => {
      expect(() => guardUnrestrictedCriteria(criteria, "delete")).not.toThrow();
    });
  });

  describe("criteria that restrict nothing (throws)", () => {
    // The guard this replaces counted `Object.keys(criteria).length`, so every
    // shape below except the first has ONE key, passed, and affected every row.
    test.each([
      ["an empty object", {}],
      ["an undefined value", { name: undefined }],
      ["an empty operator bag", { name: {} }],
      ["an undefined operand", { name: { $eq: undefined } }],
      ["an empty $nin list", { ids: { $nin: [] } }],
      ["an empty $and", { $and: [] }],
    ])("%s", (_label, criteria) => {
      expect(() => guardUnrestrictedCriteria(criteria, "delete")).toThrow(
        ProteusRepositoryError,
      );
    });
  });

  test("names the operation and its explicit escape hatch", () => {
    expect(() => guardUnrestrictedCriteria({}, "delete")).toThrow(
      /delete requires restrictive criteria/,
    );
    expect(() => guardUnrestrictedCriteria({}, "updateMany")).toThrow(
      /updateMany requires restrictive criteria/,
    );
  });

  test("carries the operation on the error", () => {
    try {
      guardUnrestrictedCriteria({}, "updateMany");
      expect.unreachable();
    } catch (error) {
      expect((error as ProteusRepositoryError).code).toBe("unrestricted_criteria");
      expect((error as ProteusRepositoryError).data).toEqual({
        operation: "updateMany",
      });
      expect((error as ProteusRepositoryError).details).toContain("updateAll()");
    }
  });
});
