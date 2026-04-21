import { calculateWorkers } from "./calculate-workers.js";
import { describe, expect, test } from "vitest";

describe("calculateWorkers", () => {
  test("should return an empty array", () => {
    expect(calculateWorkers()).toEqual([]);
  });
});
