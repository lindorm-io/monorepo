import { describe, expect, test } from "vitest";
import { composeFailures } from "./compose-failures.js";

describe("composeFailures", () => {
  test("should return a single failure untouched — no appendix, same instance", () => {
    const primary = new Error("step failed");

    expect(composeFailures([primary])).toBe(primary);
    expect(primary.message).toBe("step failed");
  });

  test("should append later failures to the PRIMARY's message, preserving its instance", () => {
    const primary = new Error("step failed") as Error & {
      actual: string;
      expected: string;
    };
    primary.actual = "a";
    primary.expected = "b";

    const composed = composeFailures([
      primary,
      new Error("@AfterScenario hook failed\n\nreport upload failed"),
      new Error("Context class AesContext dispose() threw\n\nclosed"),
    ]);

    // The same instance: the assertion actual/expected pair survives, so
    // vitest still prints an expect() diff for the primary failure.
    expect(composed).toBe(primary);
    expect(composed).toHaveProperty("actual", "a");
    expect(composed.message).toMatchSnapshot();
  });
});
