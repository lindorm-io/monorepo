import { randomString } from "./random-string.js";
import { describe, expect, test } from "vitest";

describe("randomString", () => {
  test("should return a string of the correct length", () => {
    expect(randomString(32).length).toEqual(32);
  });

  test("should include exact number of digits when specified", () => {
    const result = randomString(32, { numbers: 4 });
    expect(result.split("").filter((c) => /\d/.test(c)).length).toEqual(4);
  });

  test("should include exact number of symbols when specified", () => {
    const result = randomString(32, { symbols: 4 });
    expect(result.split("").filter((c) => !/[A-Za-z0-9]/.test(c)).length).toEqual(4);
  });
});
