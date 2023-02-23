import { extractSearchParams } from "./extract-search-params";

describe("extractSearchParams", () => {
  test("should resolve", () => {
    expect(
      extractSearchParams(
        new URL("https://test.lindorm.io:4000/test/path?query_one=one&test_two=two&HelloThere=123"),
      ),
    ).toStrictEqual({
      queryOne: "one",
      testTwo: "two",
      helloThere: 123,
    });
  });

  test("should resolve without query params", () => {
    expect(extractSearchParams(new URL("https://test.lindorm.io:4000/test/path"))).toStrictEqual(
      {},
    );
  });
});
