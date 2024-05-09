import { randomString } from "./random-string";

describe("randomString", () => {
  test("should return a random string", () => {
    expect(randomString(10)).toEqual(expect.any(String));
  });
});
