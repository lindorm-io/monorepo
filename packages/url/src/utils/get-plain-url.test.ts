import { getPlainUrl } from "./get-plain-url";

describe("getPlainUrl", () => {
  test("should resolve with query params", () => {
    expect(
      getPlainUrl(
        new URL("https://test.lindorm.io:4000/test/path?query_one=one&test_two=two&HelloThere=123"),
      ).toString(),
    ).toEqual("https://test.lindorm.io:4000/test/path");
  });

  test("should resolve without query params", () => {
    expect(getPlainUrl(new URL("https://test.lindorm.io:4000/test/path")).toString()).toEqual(
      "https://test.lindorm.io:4000/test/path",
    );
  });

  test("should resolve without path", () => {
    expect(getPlainUrl(new URL("https://test.lindorm.io:4000")).toString()).toEqual(
      "https://test.lindorm.io:4000/",
    );
  });

  test("should resolve without port", () => {
    expect(getPlainUrl(new URL("https://test.lindorm.io")).toString()).toEqual(
      "https://test.lindorm.io/",
    );
  });
});
