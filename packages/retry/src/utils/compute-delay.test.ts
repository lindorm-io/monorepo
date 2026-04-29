import { computeDelay } from "./compute-delay.js";
import { describe, expect, test } from "vitest";

describe("computeDelay", () => {
  describe("exponential (default)", () => {
    test("should return base delay for attempt 1", () => {
      expect(computeDelay(1)).toMatchSnapshot();
    });

    test("should double for attempt 2", () => {
      expect(computeDelay(2)).toMatchSnapshot();
    });

    test("should quadruple for attempt 3", () => {
      expect(computeDelay(3)).toMatchSnapshot();
    });

    test("should increase for attempt 4", () => {
      expect(computeDelay(4)).toMatchSnapshot();
    });

    test("should respect custom delay", () => {
      expect(computeDelay(3, { delay: 200 })).toMatchSnapshot();
    });

    test("should respect custom multiplier", () => {
      expect(computeDelay(3, { multiplier: 3 })).toMatchSnapshot();
    });

    test("should cap at delayMax", () => {
      expect(computeDelay(20, { delayMax: 5000 })).toMatchSnapshot();
    });
  });

  describe("linear", () => {
    test("should return delay * 1 for attempt 1", () => {
      expect(computeDelay(1, { strategy: "linear" })).toMatchSnapshot();
    });

    test("should return delay * 2 for attempt 2", () => {
      expect(computeDelay(2, { strategy: "linear" })).toMatchSnapshot();
    });

    test("should return delay * 3 for attempt 3", () => {
      expect(computeDelay(3, { strategy: "linear" })).toMatchSnapshot();
    });

    test("should respect custom delay", () => {
      expect(computeDelay(2, { strategy: "linear", delay: 250 })).toMatchSnapshot();
    });

    test("should cap at delayMax", () => {
      expect(computeDelay(100, { strategy: "linear", delayMax: 5000 })).toMatchSnapshot();
    });
  });

  describe("constant", () => {
    test("should return same delay for any attempt", () => {
      expect(computeDelay(1, { strategy: "constant" })).toMatchSnapshot();
      expect(computeDelay(5, { strategy: "constant" })).toMatchSnapshot();
      expect(computeDelay(100, { strategy: "constant" })).toMatchSnapshot();
    });

    test("should respect custom delay", () => {
      expect(computeDelay(1, { strategy: "constant", delay: 500 })).toMatchSnapshot();
    });

    test("should cap at delayMax", () => {
      expect(
        computeDelay(1, { strategy: "constant", delay: 200, delayMax: 50 }),
      ).toMatchSnapshot();
    });
  });

  describe("jitter", () => {
    test("should return a value between 50% and 100% of computed delay", () => {
      const results = new Set<number>();
      for (let i = 0; i < 100; i++) {
        results.add(computeDelay(3, { jitter: true }));
      }
      // With 100 iterations, jitter should produce multiple distinct values
      expect(results.size).toBeGreaterThan(1);

      for (const value of results) {
        // attempt 3, delay 100, multiplier 2 => 100 * 2^2 = 400
        // jitter range: 200 to 400
        expect(value).toBeGreaterThanOrEqual(200);
        expect(value).toBeLessThanOrEqual(400);
      }
    });

    test("should cap jittered value at delayMax", () => {
      for (let i = 0; i < 50; i++) {
        const value = computeDelay(20, { jitter: true, delayMax: 1000 });
        expect(value).toBeLessThanOrEqual(1000);
        expect(value).toBeGreaterThanOrEqual(500);
      }
    });
  });
});
