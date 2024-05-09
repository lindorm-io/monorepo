import { randomNumber } from "./random-number";

describe("randomNumber", () => {
  test("should return a random number", () => {
    expect(randomNumber(10)).toEqual(expect.any(Number));
  });
});
