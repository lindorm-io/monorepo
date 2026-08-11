import { describe, expect, test } from "vitest";
import { analyzeRestriction } from "./analyze-restriction.js";

describe("analyzeRestriction", () => {
  describe("restricts nothing", () => {
    // Every one of these has at least one criteria KEY, which is what the
    // guard used to count — and every one affects every row.
    test.each([
      ["an empty criteria object", {}],
      ["a key whose value is undefined", { name: undefined }],
      ["an operator bag whose only value is undefined", { name: { $eq: undefined } }],
      ["an operator bag whose every value is undefined", { name: { $gt: undefined } }],
      ["an empty operator bag", { name: {} }],
      ["an empty $nin exclusion list", { tag: { $nin: [] } }],
      ["an empty $and", { $and: [] }],
      ["an $and of unconstrained members", { $and: [{}, { name: undefined }] }],
      ["an $or with one unconstrained member", { $or: [{ name: "a" }, {}] }],
      ["a negated impossible condition", { $not: { tag: { $in: [] } } }],
      [
        "a field-level $or with an unconstrained member",
        { tag: { $or: [{ $nin: [] }] } },
      ],
      // `$overlap: []` holds for no row, so its negation holds for every one —
      // including a row whose column is NULL, which `Matcher.filter` confirms.
      // The exclusion-list spelling of `$nin: []`, and the same wipe.
      ["a negated empty $overlap", { tags: { $not: { $overlap: [] } } }],
      ["a criteria-level negated empty $overlap", { $not: { tags: { $overlap: [] } } }],
    ])("%s", (_label, criteria) => {
      expect(analyzeRestriction(criteria)).toBe("always-true");
    });
  });

  describe("can never hold", () => {
    // Allowed on a destructive operation: matching no rows is a legitimate
    // outcome, and the opposite state from `$nin: []`.
    test.each([
      ["an empty $in list", { tag: { $in: [] } }],
      ["an empty $overlap list", { tags: { $overlap: [] } }],
      [
        "an $or whose only member is an empty $overlap",
        { $or: [{ tags: { $overlap: [] } }] },
      ],
      ["an empty $or", { $or: [] }],
      ["a negated unconstrained condition", { $not: {} }],
      ["a conjunction holding an impossible member", { name: "a", tag: { $in: [] } }],
      ["an $or of impossible members", { $or: [{ tag: { $in: [] } }] }],
      ["a field-level $not over an empty exclusion", { tag: { $not: { $nin: [] } } }],
      // The driver refuses this one for its shape before it runs; the guard
      // classifying it as impossible is the safe side of that race either way.
      ["a field-level $not over an empty bag", { name: { $not: {} } }],
    ])("%s", (_label, criteria) => {
      expect(analyzeRestriction(criteria)).toBe("always-false");
    });
  });

  describe("restricts", () => {
    test.each([
      ["a bare equality", { name: "Alice" }],
      ["an explicit null", { name: null }],
      ["an explicit $eq null", { name: { $eq: null } }],
      ["a bare array containment", { tags: ["a"] }],
      ["a bare nested object", { payload: { city: "Oslo" } }],
      ["a comparison", { age: { $gt: 18 } }],
      ["a non-empty $in", { tag: { $in: ["a"] } }],
      ["a non-empty $nin", { tag: { $nin: ["a"] } }],
      ["$exists", { name: { $exists: true } }],
      ["a Date value", { createdAt: new Date() }],
      ["a mixed bag with one supplied operator", { age: { $gt: 5, $lt: undefined } }],
      ["an $and with one restrictive member", { $and: [{}, { name: "a" }] }],
      ["an $or where every member restricts", { $or: [{ name: "a" }, { name: "b" }] }],
      ["a negated restriction", { $not: { name: "a" } }],
      ["a field-level $and", { age: { $and: [{ $gt: 1 }, { $lt: 9 }] } }],
      ["an unknown operator the driver will refuse", { name: { $bogus: 1 } }],
      // The empty-containment forms that only LOOK like `$nin: []`. Every
      // expectation is `Matcher.filter` over rows holding a list, an empty list
      // and a NULL: `$all: []` / `$has: []` / the bare `[]` select every list
      // and no NULL — the same rows `$exists: true` selects, and nothing at all
      // over a scalar column — while `$contained: []` selects only the row whose
      // own list is empty. Rating any of them unrestricted refuses a legitimate
      // delete.
      ["an empty $all requirement list", { tags: { $all: [] } }],
      ["an empty $has containment", { tags: { $has: [] } }],
      ["an empty $contained set", { tags: { $contained: [] } }],
      ["a bare empty array", { tags: [] }],
      ["a negated empty $all", { tags: { $not: { $all: [] } } }],
      ["a non-empty $overlap", { tags: { $overlap: ["a"] } }],
    ])("%s", (_label, criteria) => {
      expect(analyzeRestriction(criteria)).toBe("restricts");
    });
  });

  // A non-object criteria is malformed rather than unrestricted. Reading it as
  // restricting leaves the error to the driver instead of shadowing it.
  test("treats a non-object criteria as restrictive", () => {
    expect(analyzeRestriction(null)).toBe("restricts");
    expect(analyzeRestriction("nope")).toBe("restricts");
  });
});
