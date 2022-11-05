import { randomNumberAsync } from "./random-number";

describe("randomNumber", () => {
  test("should return a random number async", async () => {
    await expect(randomNumberAsync(10)).resolves.toStrictEqual(expect.any(Number));
  });
});
