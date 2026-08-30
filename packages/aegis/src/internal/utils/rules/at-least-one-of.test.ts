import { describe, expect, test } from "vitest";
import { atLeastOneOf } from "./at-least-one-of.js";

describe("atLeastOneOf", () => {
  test("passes when one member of the group is present", () => {
    expect(atLeastOneOf({ sub: "a" }, ["sub", "sid"], new Set())).toEqual([]);
  });

  test("passes when the other member is present", () => {
    expect(atLeastOneOf({ sid: "s" }, ["sub", "sid"], new Set())).toEqual([]);
  });

  test("fails when no member of the group is present", () => {
    expect(atLeastOneOf({}, ["sub", "sid"], new Set())).toMatchSnapshot();
  });

  // A claim carrying an empty string identifies nobody, so it cannot be the one
  // member that satisfies the alternation.
  test("fails when every member is present but empty", () => {
    expect(
      atLeastOneOf({ sub: "", sid: null }, ["sub", "sid"], new Set()),
    ).toMatchSnapshot();
  });

  test("a member the writer would leave off the wire does not satisfy the group", () => {
    expect(atLeastOneOf({ sub: 42 }, ["sub", "sid"], new Set(["sub"]))).toEqual([
      { key: "sub|sid", message: "At least one of [sub, sid] is required" },
    ]);
  });

  test("a member the writer would leave off the wire does not mask another member that satisfies the group", () => {
    expect(atLeastOneOf({ sub: 42, sid: "s" }, ["sub", "sid"], new Set(["sub"]))).toEqual(
      [],
    );
  });
});
