import { randomUnreserved } from "./random-unreserved";

describe("randomUnreserved", () => {
  test("should return a random unreserved", () => {
    expect(randomUnreserved(10)).toEqual(expect.any(String));
  });
});
