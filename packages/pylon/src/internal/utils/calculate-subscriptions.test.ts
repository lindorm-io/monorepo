import { calculateSubscriptions } from "./calculate-subscriptions";

describe("calculateSubscriptions", () => {
  test("should return an empty array", () => {
    expect(calculateSubscriptions()).toEqual([]);
  });
});
