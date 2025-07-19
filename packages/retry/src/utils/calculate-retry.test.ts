import { calculateRetry } from "./calculate-retry";

describe("calculateRetry", () => {
  describe("linear", () => {
    test("should resolve for attempt #1", () => {
      expect(calculateRetry(1, { strategy: "linear" })).toEqual(100);
    });

    test("should resolve for attempt #2", () => {
      expect(calculateRetry(2, { strategy: "linear" })).toEqual(200);
    });

    test("should resolve for attempt #3", () => {
      expect(calculateRetry(3, { strategy: "linear" })).toEqual(300);
    });

    test("should resolve for attempt #3", () => {
      expect(calculateRetry(4, { strategy: "linear" })).toEqual(400);
    });

    test("should resolve maximum", () => {
      expect(calculateRetry(60, { strategy: "linear", timeoutMax: 5000 })).toEqual(5000);
    });

    test("should resolve for custom timeout", () => {
      expect(calculateRetry(2, { strategy: "linear", timeout: 250 })).toEqual(500);
    });
  });

  describe("constant", () => {
    test("should resolve for attempt #1", () => {
      expect(calculateRetry(1, { strategy: "constant" })).toEqual(100);
    });

    test("should resolve for attempt #2", () => {
      expect(calculateRetry(2, { strategy: "constant" })).toEqual(100);
    });

    test("should resolve for attempt #3", () => {
      expect(calculateRetry(3, { strategy: "constant" })).toEqual(100);
    });

    test("should resolve for attempt #3", () => {
      expect(calculateRetry(4, { strategy: "constant" })).toEqual(100);
    });

    test("should resolve maximum", () => {
      expect(calculateRetry(60, { strategy: "constant", timeoutMax: 50 })).toEqual(50);
    });

    test("should resolve for custom timeout", () => {
      expect(calculateRetry(2, { strategy: "constant", timeout: 100 })).toEqual(100);
    });
  });

  describe("exponential", () => {
    test("should resolve for attempt #1", () => {
      expect(calculateRetry(1, { strategy: "exponential" })).toEqual(100);
    });

    test("should resolve for attempt #2", () => {
      expect(calculateRetry(2, { strategy: "exponential" })).toEqual(200);
    });

    test("should resolve for attempt #3", () => {
      expect(calculateRetry(3, { strategy: "exponential" })).toEqual(400);
    });

    test("should resolve for attempt #4", () => {
      expect(calculateRetry(4, { strategy: "exponential" })).toEqual(800);
    });

    test("should resolve maximum", () => {
      expect(calculateRetry(60, { strategy: "exponential", timeoutMax: 5000 })).toEqual(
        5000,
      );
    });

    test("should resolve for custom timeout", () => {
      expect(calculateRetry(3, { strategy: "exponential", timeout: 300 })).toEqual(1200);
    });
  });
});
