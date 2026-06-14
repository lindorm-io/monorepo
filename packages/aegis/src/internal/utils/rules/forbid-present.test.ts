import { describe, expect, test } from "vitest";
import { forbidPresent } from "./forbid-present.js";

describe("forbidPresent", () => {
  test("returns no entries when no forbidden claim is present", () => {
    expect(forbidPresent({ sub: "a" }, ["nonce", "exp"])).toEqual([]);
  });

  test("returns an entry per present forbidden claim", () => {
    expect(forbidPresent({ nonce: "n", exp: 1 }, ["nonce", "exp"])).toMatchSnapshot();
  });
});
