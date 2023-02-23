import { extractValidUrl } from "./extract-valid-url";

describe("extractValidUrl", () => {
  test("should resolve for URL", () => {
    expect(extractValidUrl(new URL("https://test.lindorm.io:3000/test/path"))).toStrictEqual(
      expect.any(URL),
    );
  });

  test("should resolve for string", () => {
    expect(extractValidUrl("https://test.lindorm.io:3000/test/path")).toStrictEqual(
      expect.any(URL),
    );
  });

  test("should resolve for string with base url", () => {
    expect(extractValidUrl("/test/path", "https://test.lindorm.io:3000")).toStrictEqual(
      expect.any(URL),
    );
  });

  test("should throw for invalid URL", () => {
    expect(() => extractValidUrl(new URL("lindorm.io/test/path"))).toThrow();
  });

  test("should throw for invalid string", () => {
    expect(() => extractValidUrl("lindorm.io/test/path")).toThrow();
  });
});
