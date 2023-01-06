import { isValidUrlString } from "./is-valid-url-string";

describe("isValidUrlString", () => {
  test("should resolve with protocol", () => {
    expect(isValidUrlString("https://lindorm.io")).toBe(true);
  });

  test("should resolve without protocol", () => {
    expect(isValidUrlString("lindorm.io")).toBe(false);
  });

  test("should return false", () => {
    expect(isValidUrlString("/test/path")).toBe(false);
  });
});
