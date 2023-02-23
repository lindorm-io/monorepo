import { extractPlainUrlString } from "./extract-plain-url-string";

describe("extractPlainUrlString", () => {
  test("should resolve with query params", () => {
    expect(
      extractPlainUrlString(
        new URL("https://test.lindorm.io:4000/test/path?query_one=one&test_two=two&HelloThere=123"),
      ),
    ).toBe("https://test.lindorm.io:4000/test/path");
  });

  test("should resolve without query params", () => {
    expect(extractPlainUrlString(new URL("https://test.lindorm.io:4000/test/path"))).toBe(
      "https://test.lindorm.io:4000/test/path",
    );
  });
});
