import { randomString } from "./random-string";

describe("randomString", () => {
  test("should return a random string", () => {
    expect(randomString(32)).toStrictEqual(expect.any(String));
  });

  test("should not throw on short length", () => {
    expect(() => randomString(1).length).not.toThrow();
  });

  test("should respect length argument", () => {
    expect(randomString(1).length).toBe(1);
    expect(randomString(4).length).toBe(4);
    expect(randomString(8).length).toBe(8);
    expect(randomString(16).length).toBe(16);
    expect(randomString(32).length).toBe(32);
    expect(randomString(64).length).toBe(64);
    expect(randomString(128).length).toBe(128);
  });

  test("should resolve a specific amount of numbers", () => {
    expect(
      randomString(32, { numbers: 3 })
        .split("")
        .filter((s) => /\d/.test(s)).length,
    ).toBe(3);
  });

  test("should resolve a specific amount of symbols", () => {
    expect(
      randomString(32, { symbols: 3 })
        .split("")
        .filter((s) => !/[A-Za-z0-9]/.test(s)).length,
    ).toBe(3);
  });

  test("should resolve custom chars", () => {
    expect(randomString(8, { custom: { chars: "A" } })).toBe("AAAAAAAA");
  });

  test("should resolve custom numbers", () => {
    expect(randomString(8, { numbers: 8, custom: { numbers: "0" } })).toBe("00000000");
  });

  test("should resolve custom symbols", () => {
    expect(randomString(8, { symbols: 8, custom: { symbols: "%" } })).toBe("%%%%%%%%");
  });
});
