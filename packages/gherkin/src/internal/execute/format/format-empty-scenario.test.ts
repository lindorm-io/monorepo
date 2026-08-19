import { describe, expect, test } from "vitest";
import { formatEmptyScenario } from "./format-empty-scenario.js";

describe("formatEmptyScenario", () => {
  test("should anchor to the scenario line", () => {
    const message = formatEmptyScenario(
      { kind: "empty-scenario", column: 3, line: 6, name: "nothing here" },
      "src/features/aes.feature",
    );

    expect(message).toContain("Empty scenario");
    expect(message).toContain("  nothing here");
    expect(message).toContain("at src/features/aes.feature:6:3");
    expect(message).toContain("zero steps");
    expect(message).toMatchSnapshot();
  });
});
