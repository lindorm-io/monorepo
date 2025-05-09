import { Dict } from "@lindorm/types";
import { merge } from "./merge";

describe("merge", () => {
  test("should merge objects", () => {
    expect(
      merge<Dict>(
        {
          a: 1,
          b: 1,
          c: 1,
          d: 1,
        },
        {
          b: 2,
          c: 2,
          d: 2,
        },
        {
          c: 3,
          d: 4,
          e: 5,
        },
      ),
    ).toEqual({
      a: 1,
      b: 2,
      c: 3,
      d: 4,
      e: 5,
    });
  });

  test("should merge objects with arrays", () => {
    expect(
      merge<Dict>(
        {
          a: [1],
          b: [1],
          c: [1],
          d: [1],
        },
        {
          b: [2],
          c: [2],
          d: [2],
        },
        {
          c: [3],
          d: [4],
          e: [5],
        },
      ),
    ).toEqual({
      a: [1],
      b: [1, 2],
      c: [1, 2, 3],
      d: [1, 2, 4],
      e: [5],
    });
  });
});
