import { calculateWorkers } from "./calculate-workers";

describe("calculateWorkers", () => {
  test("should return an empty array", () => {
    expect(calculateWorkers()).toEqual([]);
  });
});
