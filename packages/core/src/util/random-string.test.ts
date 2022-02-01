import { getRandomString } from "./random-string";

describe("getRandomString", () => {
  test("should return a random string", () => {
    expect(getRandomString(32)).toStrictEqual(expect.any(String));
  });

  test("should respect length argument", () => {
    expect(getRandomString(32).length).toBe(32);
  });
});
