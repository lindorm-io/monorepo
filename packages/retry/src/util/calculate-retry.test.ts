import { calculateRetry } from "./calculate-retry";

describe("calculateRetry", () => {
  describe("linear", () => {
    test("should resolve for attempt #1", () => {
      expect(calculateRetry(1)).toBe(500);
    });

    test("should resolve for attempt #2", () => {
      expect(calculateRetry(2)).toBe(1000);
    });

    test("should resolve for attempt #3", () => {
      expect(calculateRetry(3)).toBe(1500);
    });

    test("should resolve for attempt #3", () => {
      expect(calculateRetry(4)).toBe(2000);
    });

    test("should resolve for custom milliseconds", () => {
      expect(calculateRetry(1, { milliseconds: 250 })).toBe(250);
    });
  });

  describe("linear", () => {
    test("should resolve for attempt #1", () => {
      expect(calculateRetry(1, { strategy: "exponential" })).toBe(500);
    });

    test("should resolve for attempt #2", () => {
      expect(calculateRetry(2, { strategy: "exponential" })).toBe(1000);
    });

    test("should resolve for attempt #3", () => {
      expect(calculateRetry(3, { strategy: "exponential" })).toBe(2000);
    });

    test("should resolve for attempt #4", () => {
      expect(calculateRetry(4, { strategy: "exponential" })).toBe(4000);
    });

    test("should resolve maximum", () => {
      expect(calculateRetry(60, { strategy: "exponential" })).toBe(30000);
    });

    test("should resolve for custom milliseconds", () => {
      expect(calculateRetry(1, { milliseconds: 250, strategy: "exponential" })).toBe(250);
    });
  });
});
