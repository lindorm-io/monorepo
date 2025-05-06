import { sortKeys } from "./sort-keys";

describe("sortKeys", () => {
  test("should sort object keys alphabetically", () => {
    expect(
      sortKeys({
        e: 1,
        b: 1,
        d: {
          k: 1,
          u: 1,
          a: 1,
          c: 1,
          f: {
            i: 1,
            h: 1,
            g: 1,
          },
        },
        z: 1,
        a: 2,
      }),
    ).toMatchSnapshot();
  });
});
