import { randomToken } from "./random-token";

describe("randomToken", () => {
  test("should return a random token", () => {
    expect(randomToken(10)).toEqual(expect.any(String));
  });
});
