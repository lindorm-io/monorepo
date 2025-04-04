import { extractSearchParams } from "./extract-search-params";

describe("extractSearchParams", () => {
  test("should resolve", () => {
    expect(
      extractSearchParams(
        new URL(
          "https://test.lindorm.io:4000/test/path?queryCamel=one&test_snake=true&HelloPascal=123",
        ),
      ),
    ).toEqual({
      queryCamel: "one",
      test_snake: true,
      HelloPascal: 123,
    });
  });

  test("should resolve without query params", () => {
    expect(
      extractSearchParams(new URL("https://test.lindorm.io:4000/test/path")),
    ).toEqual({});
  });
});
