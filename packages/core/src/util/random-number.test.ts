import { getRandomNumber } from "./random-number";

describe("getRandomNumber", () => {
  test("should return a random number", () => {
    expect(getRandomNumber(10)).toStrictEqual(expect.any(Number));
  });
});
