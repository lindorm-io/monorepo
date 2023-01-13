import { randomInteger } from "./random-integer";

describe("randomInteger", () => {
  test("should return a random number", () => {
    expect(randomInteger(1)).toBeLessThanOrEqual(1);
    expect(randomInteger(2)).toBeLessThanOrEqual(2);
    expect(randomInteger(4)).toBeLessThanOrEqual(4);
    expect(randomInteger(8)).toBeLessThanOrEqual(8);
  });
});
