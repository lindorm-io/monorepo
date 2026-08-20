import { describe, expect, test } from "vitest";
import { formatEmptyExamples } from "./format-empty-examples.js";

describe("formatEmptyExamples", () => {
  test("should anchor to the Examples line", () => {
    const message = formatEmptyExamples(
      {
        kind: "empty-examples",
        column: 5,
        line: 14,
        name: "every content encryption round-trips",
        tags: [],
      },
      "src/features/aes.feature",
    );

    expect(message).toContain("Empty Examples table");
    expect(message).toContain("  every content encryption round-trips");
    expect(message).toContain("at src/features/aes.feature:14:5");
    expect(message).toContain("zero data rows");
    expect(message).toMatchSnapshot();
  });
});
