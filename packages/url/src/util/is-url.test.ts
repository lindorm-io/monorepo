import { isURL } from "./is-url";

describe("isURL", () => {
  test("should return true", () => {
    expect(isURL(new URL("https://lindorm.io"))).toBe(true);
  });

  test("should return false", () => {
    expect(isURL("https://lindorm.io")).toBe(false);
  });
});
