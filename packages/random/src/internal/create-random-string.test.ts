import { createRandomString } from "./create-random-string.js";
import { describe, expect, test } from "vitest";

describe("_createRandomString", () => {
  test("should respect length argument", () => {
    expect(createRandomString(1).length).toEqual(1);
    expect(createRandomString(4).length).toEqual(4);
    expect(createRandomString(8).length).toEqual(8);
    expect(createRandomString(16).length).toEqual(16);
    expect(createRandomString(32).length).toEqual(32);
    expect(createRandomString(64).length).toEqual(64);
    expect(createRandomString(128).length).toEqual(128);
  });

  test("should include exact number of digits", () => {
    const result = createRandomString(32, 4);
    expect(result.split("").filter((c) => /\d/.test(c)).length).toEqual(4);
  });

  test("should include exact number of symbols", () => {
    const result = createRandomString(32, 0, 4);
    expect(result.split("").filter((c) => !/[A-Za-z0-9]/.test(c)).length).toEqual(4);
  });

  test("should throw when numbers + symbols exceed length", () => {
    expect(() => createRandomString(4, 3, 3)).toThrow();
  });
});
