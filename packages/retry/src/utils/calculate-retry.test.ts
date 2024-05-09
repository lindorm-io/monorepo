import { RetryStrategy } from "../enums";
import { calculateRetry } from "./calculate-retry";

describe("calculateRetry", () => {
  describe("linear", () => {
    test("should resolve for attempt #1", () => {
      expect(calculateRetry(1, { strategy: RetryStrategy.Linear })).toEqual(100);
    });

    test("should resolve for attempt #2", () => {
      expect(calculateRetry(2, { strategy: RetryStrategy.Linear })).toEqual(200);
    });

    test("should resolve for attempt #3", () => {
      expect(calculateRetry(3, { strategy: RetryStrategy.Linear })).toEqual(300);
    });

    test("should resolve for attempt #3", () => {
      expect(calculateRetry(4, { strategy: RetryStrategy.Linear })).toEqual(400);
    });

    test("should resolve maximum", () => {
      expect(calculateRetry(60, { strategy: RetryStrategy.Linear, timeoutMax: 5000 })).toEqual(
        5000,
      );
    });

    test("should resolve for custom timeout", () => {
      expect(calculateRetry(2, { strategy: RetryStrategy.Linear, timeout: 250 })).toEqual(500);
    });
  });

  describe("linear", () => {
    test("should resolve for attempt #1", () => {
      expect(calculateRetry(1, { strategy: RetryStrategy.Exponential })).toEqual(100);
    });

    test("should resolve for attempt #2", () => {
      expect(calculateRetry(2, { strategy: RetryStrategy.Exponential })).toEqual(200);
    });

    test("should resolve for attempt #3", () => {
      expect(calculateRetry(3, { strategy: RetryStrategy.Exponential })).toEqual(400);
    });

    test("should resolve for attempt #4", () => {
      expect(calculateRetry(4, { strategy: RetryStrategy.Exponential })).toEqual(800);
    });

    test("should resolve maximum", () => {
      expect(calculateRetry(60, { strategy: RetryStrategy.Exponential, timeoutMax: 5000 })).toEqual(
        5000,
      );
    });

    test("should resolve for custom timeout", () => {
      expect(calculateRetry(3, { strategy: RetryStrategy.Exponential, timeout: 300 })).toEqual(
        1200,
      );
    });
  });
});
