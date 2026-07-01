import { generateSupport } from "./generate-support.js";
import { describe, expect, test } from "vitest";

const UNAMBIGUOUS = "[ABCDEFGHJKMNPQRSTUVWXYZ23456789]";
const SUPPORT_RE = new RegExp(
  `^[ABCDEFGHJKMN](0[1-9]|[12]\\d|3[01])-${UNAMBIGUOUS}{4}-${UNAMBIGUOUS}{4}$`,
);

describe("generateSupport", () => {
  test("should generate a <monthLetter><day>-XXXX-XXXX code", () => {
    expect(generateSupport()).toMatch(SUPPORT_RE);
  });

  test("should encode the UTC month letter and day prefix", () => {
    // July → month index 6 → "G"; day 01.
    expect(generateSupport(new Date("2026-07-01T12:00:00.000Z"))).toMatch(/^G01-/);
    // December → month index 11 → "N"; day 25.
    expect(generateSupport(new Date("2026-12-25T23:59:59.000Z"))).toMatch(/^N25-/);
    // January → "A"; day 09 (zero-padded).
    expect(generateSupport(new Date("2026-01-09T00:00:00.000Z"))).toMatch(/^A09-/);
  });

  test("the two random groups never contain ambiguous characters (0/O/1/I/L)", () => {
    for (let i = 0; i < 200; i++) {
      const random = generateSupport().slice(4); // drop the "<M><DD>-" prefix
      expect(random).not.toMatch(/[0O1IL]/);
    }
  });

  test("should be random across calls", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateSupport()));
    expect(codes.size).toBeGreaterThan(45);
  });
});
