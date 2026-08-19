import { describe, expect, test } from "vitest";
import { formatParseError } from "./format-parse-error.js";

describe("formatParseError", () => {
  test("should anchor every entry to its uri:line:column", () => {
    const message = formatParseError({
      errors: [
        { column: 3, line: 4, message: "(4:3): expected: #EOF, got 'rogue line'" },
        { column: 3, line: 5, message: "(5:3): expected: #EOF, got 'another rogue'" },
      ],
      kind: "parse-error",
      uri: "src/features/broken.feature",
    });

    expect(message).toContain("Failed to parse feature file");
    expect(message).toContain("(4:3): expected: #EOF, got 'rogue line'");
    expect(message).toContain("at src/features/broken.feature:4:3");
    expect(message).toContain("(5:3): expected: #EOF, got 'another rogue'");
    expect(message).toContain("at src/features/broken.feature:5:3");
    expect(message).toContain(
      "Fix the first error first — later ones are often knock-ons.",
    );
    expect(message).toMatchSnapshot();
  });

  test("should render the uri and line for an entry without a column", () => {
    const message = formatParseError({
      errors: [{ line: 7, message: "(7:0): bad ast" }],
      kind: "parse-error",
      uri: "src/features/broken.feature",
    });

    expect(message).toContain("at src/features/broken.feature:7\n");
    expect(message).toMatchSnapshot();
  });

  test("should render the uri alone for an entry without a location", () => {
    const message = formatParseError({
      errors: [{ message: "(-1:-1): Language not supported: xx" }],
      kind: "parse-error",
      uri: "src/features/broken.feature",
    });

    expect(message).toContain("(-1:-1): Language not supported: xx");
    expect(message).toContain("at src/features/broken.feature\n");
    expect(message).toMatchSnapshot();
  });
});
