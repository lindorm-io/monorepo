import { parseRangeHeader } from "./parse-range-header.js";
import { describe, expect, test } from "vitest";

const SIZE = 100;

describe("parseRangeHeader", () => {
  describe("ignored (serve full 200)", () => {
    test.each([
      ["absent header", undefined],
      ["non-bytes unit", "items=0-9"],
      ["multiple ranges", "bytes=0-9,20-29"],
      ["no dash", "bytes=5"],
      ["negative start", "bytes=-5-10"],
      ["end before start", "bytes=50-10"],
      ["non-integer start", "bytes=1.5-10"],
      ["non-integer end", "bytes=0-9.5"],
      ["empty both sides", "bytes=-"],
    ])("%s → ignore", (_label, header) => {
      expect(parseRangeHeader(header as string | undefined, SIZE)).toEqual({
        type: "ignore",
      });
    });
  });

  describe("satisfiable (serve 206)", () => {
    test("bytes=0-9 → first ten bytes", () => {
      expect(parseRangeHeader("bytes=0-9", SIZE)).toEqual({
        type: "satisfiable",
        start: 0,
        end: 9,
      });
    });

    test("bytes=90- → open-ended tail", () => {
      expect(parseRangeHeader("bytes=90-", SIZE)).toEqual({
        type: "satisfiable",
        start: 90,
        end: 99,
      });
    });

    test("bytes=-10 → final ten bytes", () => {
      expect(parseRangeHeader("bytes=-10", SIZE)).toEqual({
        type: "satisfiable",
        start: 90,
        end: 99,
      });
    });

    test("bytes=0-999 → end clamped to size-1", () => {
      expect(parseRangeHeader("bytes=0-999", SIZE)).toEqual({
        type: "satisfiable",
        start: 0,
        end: 99,
      });
    });

    test("suffix longer than file clamps start to 0", () => {
      expect(parseRangeHeader("bytes=-999", SIZE)).toEqual({
        type: "satisfiable",
        start: 0,
        end: 99,
      });
    });
  });

  describe("unsatisfiable (serve 416)", () => {
    test("bytes=100- → first-byte-pos at size", () => {
      expect(parseRangeHeader("bytes=100-", SIZE)).toEqual({ type: "unsatisfiable" });
    });

    test("bytes=-0 → zero-length suffix", () => {
      expect(parseRangeHeader("bytes=-0", SIZE)).toEqual({ type: "unsatisfiable" });
    });

    test("any range against a zero-byte file", () => {
      expect(parseRangeHeader("bytes=0-0", 0)).toEqual({ type: "unsatisfiable" });
    });
  });
});
