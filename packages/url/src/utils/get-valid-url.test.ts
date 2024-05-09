import { getValidUrl } from "./get-valid-url";

describe("getValidUrl", () => {
  test("should resolve for URL", () => {
    expect(getValidUrl(new URL("https://test.lindorm.io:3000/test/path")).toString()).toEqual(
      "https://test.lindorm.io:3000/test/path",
    );
  });

  test("should resolve for string", () => {
    expect(getValidUrl("https://test.lindorm.io:3000/test/path").toString()).toEqual(
      "https://test.lindorm.io:3000/test/path",
    );
  });

  test("should resolve for string with base url", () => {
    expect(getValidUrl("/test/path", "https://test.lindorm.io:3000").toString()).toEqual(
      "https://test.lindorm.io:3000/test/path",
    );
  });

  test("should throw for invalid URL", () => {
    expect(() => getValidUrl(new URL("lindorm.io/test/path")).toString()).toThrow();
  });

  test("should throw for invalid string", () => {
    expect(() => getValidUrl("lindorm.io/test/path")).toThrow();
  });
});
