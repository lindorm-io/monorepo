import { describe, expect, test } from "vitest";
import { decimalFitsDouble } from "./decimal-fidelity.js";

describe("decimalFitsDouble", () => {
  test.each([
    "0",
    "0.0",
    "-0",
    "8.03",
    "12345.6789",
    "-12345.6789",
    "1.50",
    "0.1",
    "100",
    "1000000000000000000000000000000", // 1e30 — large but round
    "1e30",
    "1.5e-7",
  ])("accepts %s (round-trips through a double)", (value) => {
    expect(decimalFitsDouble(value)).toBe(true);
  });

  test.each([
    "0.123456789012345678", // 18 significant digits
    "1234567890.1234567890", // 19 significant digits
    "9007199254740993", // 2^53 + 1 — not representable
  ])("rejects %s (would lose precision)", (value) => {
    expect(decimalFitsDouble(value)).toBe(false);
  });

  test("rejects non-finite / unparseable input", () => {
    expect(decimalFitsDouble("not-a-number")).toBe(false);
    expect(decimalFitsDouble("1e400")).toBe(false); // Infinity
  });
});
