import { describe, expect, test } from "vitest";
import { requirePresent } from "./require-present.js";

describe("requirePresent", () => {
  test("returns no entries when all required claims are present", () => {
    expect(requirePresent({ sub: "a", exp: 1 }, ["sub", "exp"])).toEqual([]);
  });

  test("returns an entry per missing claim", () => {
    expect(requirePresent({ sub: "a" }, ["sub", "exp", "iss"])).toMatchSnapshot();
  });
});
