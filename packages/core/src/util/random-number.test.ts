import { getRandomNumber, getRandomNumberAsync } from "./random-number";

describe("getRandomNumber", () => {
  test("should return a random number", () => {
    expect(getRandomNumber(10)).toStrictEqual(expect.any(Number));
  });

  test("should return a random number async", async () => {
    await expect(getRandomNumberAsync(10)).resolves.toStrictEqual(expect.any(Number));
  });
});
