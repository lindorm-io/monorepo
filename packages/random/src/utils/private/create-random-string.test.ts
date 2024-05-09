import { _createRandomString } from "./create-random-string";

describe("_createRandomString", () => {
  test("should return a random string", () => {
    expect(_createRandomString(32)).toEqual(expect.any(String));
  });

  test("should not throw on short length", () => {
    expect(() => _createRandomString(1).length).not.toThrow();
  });

  test("should respect length argument", () => {
    expect(_createRandomString(1).length).toEqual(1);
    expect(_createRandomString(4).length).toEqual(4);
    expect(_createRandomString(8).length).toEqual(8);
    expect(_createRandomString(16).length).toEqual(16);
    expect(_createRandomString(32).length).toEqual(32);
    expect(_createRandomString(64).length).toEqual(64);
    expect(_createRandomString(128).length).toEqual(128);
  });

  test("should resolve a specific amount of numbers", () => {
    expect(
      _createRandomString(32, { numbersMax: 3 })
        .split("")
        .filter((s) => /\d/.test(s)).length,
    ).toEqual(3);
  });

  test("should resolve a specific amount of symbols", () => {
    expect(
      _createRandomString(32, { symbolsMax: 3 })
        .split("")
        .filter((s) => !/[A-Za-z0-9]/.test(s)).length,
    ).toEqual(3);
  });
});
