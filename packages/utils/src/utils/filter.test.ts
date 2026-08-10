import { TEST_PEOPLE } from "../__fixtures__/test-people.js";
import { filter } from "./filter.js";
import { describe, expect, test } from "vitest";

describe("filter", () => {
  test("should filter by city", () => {
    expect(filter(TEST_PEOPLE, { address: { city: "New York" } })).toEqual([
      expect.objectContaining({ id: "1" }),
      expect.objectContaining({ id: "3" }),
    ]);
  });

  test("should filter by name", () => {
    expect(filter(TEST_PEOPLE, { name: "John Doe" })).toEqual([
      expect.objectContaining({ id: "1" }),
    ]);
  });

  test("should filter by name and city", () => {
    expect(
      filter(TEST_PEOPLE, { name: "John Doe", address: { city: "New York" } }),
    ).toEqual([expect.objectContaining({ id: "1" })]);
  });

  test("should filter by friend name", () => {
    expect(filter(TEST_PEOPLE, { friends: [{ name: "Jane Black" }] })).toEqual([
      expect.objectContaining({ id: "1" }),
      expect.objectContaining({ id: "4" }),
    ]);
  });

  // A built-in exotic predicate is compared by REFERENCE, exactly as a Date or a
  // Buffer predicate always has been — it is not descended into. Pinned because
  // a RegExp predicate used to match EVERY row: `matches` recursed into it,
  // found no own keys, and `every` over nothing is vacuously true.
  test("should compare an exotic predicate by reference", () => {
    const set = new Set([1, 2]);
    const rows = [
      { id: "1", tags: set },
      { id: "2", tags: new Set([1, 2]) },
      { id: "3", tags: new Set([3]) },
    ];

    expect(filter(rows, { tags: set })).toEqual([{ id: "1", tags: set }]);
  });

  test("should not match every row for a RegExp predicate", () => {
    const rows = [{ name: "John Doe" }, { name: "Jane Black" }];

    expect(filter(rows, { name: /John/ } as any)).toEqual([]);
  });
});
