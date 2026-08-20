import { describe, expect, test } from "vitest";
import { formatTagError } from "./format-tag-error.js";

describe("formatTagError", () => {
  test("should anchor a reserved tag to its own line and carry the reason", () => {
    const message = formatTagError(
      "Unsupported tag",
      { column: 3, line: 4, name: "@skip" },
      "src/features/aes.feature",
      "this runner has no skip tag — exclude via `tags` in config",
    );

    expect(message).toContain("Unsupported tag");
    expect(message).toContain("  @skip");
    expect(message).toContain("at src/features/aes.feature:4:3");
    expect(message).toContain("no skip tag");
    expect(message).toMatchSnapshot();
  });

  test("should anchor an invalid tag NAME the same way, under its own heading", () => {
    const message = formatTagError(
      "Invalid tag name",
      { column: 1, line: 1, name: "@issue(1234)" },
      "src/features/aes.feature",
      'vitest tag names cannot contain "!", "*", "&", "|", "(" or ")"',
    );

    expect(message).toContain("Invalid tag name");
    expect(message).toContain("  @issue(1234)");
    expect(message).toContain("at src/features/aes.feature:1:1");
    expect(message).toMatchSnapshot();
  });
});
