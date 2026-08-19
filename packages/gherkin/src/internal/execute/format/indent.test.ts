import { describe, expect, test } from "vitest";
import { indent } from "./indent.js";

describe("indent", () => {
  test("should indent every non-empty line", () => {
    expect(indent("a\nb", 2)).toBe("  a\n  b");
  });

  test("should leave empty lines empty", () => {
    expect(indent("a\n\nb", 2)).toBe("  a\n\n  b");
  });
});
