import { calculateSubscriptions } from "./calculate-subscriptions.js";
import { describe, expect, test } from "vitest";

describe("calculateSubscriptions", () => {
  test("should return an empty array", () => {
    expect(calculateSubscriptions()).toEqual([]);
  });
});
