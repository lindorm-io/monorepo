import { describe, expect, test } from "vitest";
import { atLeastOneOf } from "./at-least-one-of.js";

describe("atLeastOneOf", () => {
  test("passes when one member of the group is present", () => {
    expect(atLeastOneOf({ sub: "a" }, [["sub", "sid"]])).toEqual([]);
  });

  test("passes when the other member is present", () => {
    expect(atLeastOneOf({ sid: "s" }, [["sub", "sid"]])).toEqual([]);
  });

  test("fails when no member of the group is present", () => {
    expect(atLeastOneOf({}, [["sub", "sid"]])).toMatchSnapshot();
  });
});
