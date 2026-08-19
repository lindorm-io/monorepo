import { describe, expect, test } from "vitest";
import { formatAnchor } from "./format-anchor.js";

describe("formatAnchor", () => {
  test("should render the text and its uri:line:column position", () => {
    expect(formatAnchor("some text", "src/features/aes.feature", 12, 5)).toBe(
      "  some text\n  at src/features/aes.feature:12:5",
    );
  });
});
