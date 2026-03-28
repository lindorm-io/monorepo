import { SlidingWindow } from "./sliding-window";

describe("SlidingWindow", () => {
  let window: SlidingWindow;

  beforeEach(() => {
    window = new SlidingWindow(1000);
  });

  describe("record", () => {
    it("should add a timestamp and count should reflect it", () => {
      window.record(5000);

      expect(window.count(5000)).toBe(1);
    });

    it("should prune entries outside the window on record", () => {
      window.record(1000);
      window.record(1500);
      window.record(2500);

      // At 2500, cutoff is 1500 — entry at 1000 is pruned
      expect(window.count(2500)).toBe(2);
    });

    it("should handle multiple records at the same timestamp", () => {
      window.record(5000);
      window.record(5000);
      window.record(5000);

      expect(window.count(5000)).toBe(3);
    });
  });

  describe("count", () => {
    it("should return 0 for an empty window", () => {
      expect(window.count(5000)).toBe(0);
    });

    it("should prune entries outside the window on count", () => {
      window.record(1000);
      window.record(1500);
      window.record(1800);

      // At 2500, cutoff is 1500 — entries at 1000 pruned, entry at 1500 is exactly at cutoff (< cutoff is false), so kept? No.
      // cutoff = 2500 - 1000 = 1500; timestamps[0] = 1000 < 1500 => pruned; timestamps[0] = 1500 < 1500 => false, kept
      expect(window.count(2500)).toBe(2);
    });

    it("should prune entry exactly at cutoff boundary (strictly less than)", () => {
      window.record(1000);
      window.record(2000);

      // windowMs = 1000, now = 2000, cutoff = 1000
      // timestamps[0] = 1000 < 1000 => false, so 1000 is NOT pruned
      expect(window.count(2000)).toBe(2);

      // now = 2001, cutoff = 1001
      // timestamps[0] = 1000 < 1001 => true, pruned
      expect(window.count(2001)).toBe(1);
    });
  });

  describe("reset", () => {
    it("should clear all entries", () => {
      window.record(5000);
      window.record(5100);
      window.record(5200);

      expect(window.count(5200)).toBe(3);

      window.reset();

      expect(window.count(5200)).toBe(0);
    });
  });
});
