import { describe, expect, test } from "vitest";
import { toVitestTags } from "./to-vitest-tags.js";

describe("toVitestTags", () => {
  test("should strip the leading @ from every tag", () => {
    expect(toVitestTags(["@smoke", "@slow"])).toEqual(["smoke", "slow"]);
  });

  test("should deduplicate after stripping, keeping first-appearance order", () => {
    expect(toVitestTags(["@lane", "@smoke", "@lane"])).toEqual(["lane", "smoke"]);
  });

  test("should strip only the leading @ — an interior @ is part of the name", () => {
    expect(toVitestTags(["@user@host"])).toEqual(["user@host"]);
  });

  test("should map an empty set to an empty set", () => {
    expect(toVitestTags([])).toEqual([]);
  });
});
