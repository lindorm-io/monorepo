import { randomNumber } from "./random-number";
import { describe, expect, test } from "vitest";

describe("randomNumber", () => {
  test("should return a random number", () => {
    expect(randomNumber(10)).toEqual(expect.any(Number));
  });
});
