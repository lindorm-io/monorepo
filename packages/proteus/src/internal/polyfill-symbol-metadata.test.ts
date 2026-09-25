import { describe, expect, test } from "vitest";

// Captured at module load: whichever polyfill site installed the slot first wins,
// and a test body that replaces it would hide which one that was.
const installed = (Symbol as { metadata?: symbol }).metadata;

describe("polyfill-symbol-metadata", () => {
  test("should install Symbol.metadata from the global registry, not a fresh symbol", () => {
    expect(installed).toBe(Symbol.for("Symbol.metadata"));
  });
});
