import { sortKeys } from "./sort-keys";

describe("sortKeys", () => {
  test("should sort object keys alphabetically", () => {
    expect(sortKeys({ e: 1, b: 1, z: 1, a: 2 })).toEqual({ a: 2, b: 1, e: 1, z: 1 });
  });
});
