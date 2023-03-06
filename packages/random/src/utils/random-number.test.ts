import { randomNumber } from "./random-number";

describe("randomNumber", () => {
  test("should return a random number", () => {
    expect(randomNumber(10)).toStrictEqual(expect.any(Number));
  });

  test("should respect length argument", () => {
    expect(randomNumber(1).toString().length).toBeLessThanOrEqual(1);
    expect(randomNumber(2).toString().length).toBeLessThanOrEqual(2);
    expect(randomNumber(4).toString().length).toBeLessThanOrEqual(4);
    expect(randomNumber(8).toString().length).toBeLessThanOrEqual(8);
    expect(randomNumber(16).toString().length).toBeLessThanOrEqual(16);
    expect(randomNumber(32).toString().length).toBeLessThanOrEqual(32);
  });
});
