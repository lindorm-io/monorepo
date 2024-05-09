import { randomSecret } from "./random-secret";

describe("randomSecret", () => {
  test("should return a random secret", () => {
    expect(randomSecret(10)).toEqual(expect.any(String));
  });
});
