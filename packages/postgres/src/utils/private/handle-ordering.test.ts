import { handleOrdering } from "./handle-ordering";

describe("handleOrdering", () => {
  test("should return empty string and values", () => {
    expect(handleOrdering({})).toStrictEqual({ text: "", values: [] });
  });

  test("should return order by string", () => {
    expect(handleOrdering({ order: { one: "ASC", two: "DESC" } })).toStrictEqual({
      text: ' ORDER BY "one" ASC, "two" DESC',
      values: [],
    });
  });
});
