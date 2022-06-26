import { getRandomString } from "./random-string";

describe("getRandomString", () => {
  test("should return a random string", () => {
    expect(getRandomString(32)).toStrictEqual(expect.any(String));
  });

  test("should respect length argument", () => {
    expect(getRandomString(16).length).toBe(16);
    expect(getRandomString(32).length).toBe(32);
    expect(getRandomString(64).length).toBe(64);
    expect(getRandomString(128).length).toBe(128);
  });
});
