import { describe, expect, test } from "vitest";
import { cleanId } from "./clean-id.js";

describe("cleanId", () => {
  test("should return an id without a query untouched", () => {
    expect(cleanId("/repo/src/a.feature")).toBe("/repo/src/a.feature");
  });

  test("should strip a cache-busting query suffix", () => {
    expect(cleanId("/repo/src/a.feature?v=abc123")).toBe("/repo/src/a.feature");
  });

  test("should strip everything from the first question mark", () => {
    expect(cleanId("/repo/src/a.feature?import&v=1?x")).toBe("/repo/src/a.feature");
  });
});
