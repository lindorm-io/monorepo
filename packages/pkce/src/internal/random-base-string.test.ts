import { randomBaseString } from "./random-base-string";

describe("randomBaseString", () => {
  test("should return a random string", () => {
    expect(randomBaseString(32)).toEqual(expect.any(String));
  });

  test("should respect length argument", () => {
    expect(randomBaseString(1).length).toEqual(1);
    expect(randomBaseString(4).length).toEqual(4);
    expect(randomBaseString(8).length).toEqual(8);
    expect(randomBaseString(16).length).toEqual(16);
    expect(randomBaseString(32).length).toEqual(32);
    expect(randomBaseString(64).length).toEqual(64);
    expect(randomBaseString(128).length).toEqual(128);
  });
});
