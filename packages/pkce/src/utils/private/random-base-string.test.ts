import { randomBaseString } from "./random-base-string";

describe("randomBaseString", () => {
  test("should return a random string", () => {
    expect(randomBaseString(32)).toStrictEqual(expect.any(String));
  });

  test("should respect length argument", () => {
    expect(randomBaseString(1).length).toBe(1);
    expect(randomBaseString(4).length).toBe(4);
    expect(randomBaseString(8).length).toBe(8);
    expect(randomBaseString(16).length).toBe(16);
    expect(randomBaseString(32).length).toBe(32);
    expect(randomBaseString(64).length).toBe(64);
    expect(randomBaseString(128).length).toBe(128);
  });
});
