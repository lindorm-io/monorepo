import { describe, expect, test } from "vitest";
import { defineThrowingGetter } from "../../__fixtures__/test-helpers.js";
import { composeFailures } from "./compose-failures.js";

describe("composeFailures", () => {
  test("should return a single failure untouched — no appendix, same instance", () => {
    const primary = new Error("step failed");

    expect(composeFailures([primary])).toBe(primary);
    expect(primary.message).toBe("step failed");
  });

  test("should compose a NEW error appending later failures to the PRIMARY's message, the primary as its cause", () => {
    const primary = new Error("step failed");

    const composed = composeFailures([
      primary,
      new Error("@AfterScenario hook failed\n\nreport upload failed"),
      new Error("Context class AesContext dispose() threw\n\nclosed"),
    ]);

    expect(composed).not.toBe(primary);
    expect(composed.cause).toBe(primary);
    expect(composed.message).toMatchSnapshot();
  });

  test("should leave every failure the caller holds unchanged — the primary's message, assertion pair and identity", () => {
    const primary = new Error("step failed") as Error & {
      actual: string;
      expected: string;
    };
    primary.actual = "a";
    primary.expected = "b";
    const hookFailure = new Error("@AfterScenario hook failed\n\nreport upload failed");
    const failures = [primary, hookFailure];

    composeFailures(failures);

    expect(failures[0]).toBe(primary);
    expect(failures[1]).toBe(hookFailure);
    expect(primary.message).toBe("step failed");
    expect(primary).toHaveProperty("actual", "a");
    expect(primary).toHaveProperty("expected", "b");
    expect(hookFailure.message).toBe(
      "@AfterScenario hook failed\n\nreport upload failed",
    );
  });

  test("should read a primary whose message cannot be read as empty, keeping it as the cause", () => {
    const primary = defineThrowingGetter(new Error("hidden"), "message");
    const hookFailure = new Error("@AfterScenario hook failed\n\nreport upload failed");

    const composed = composeFailures([primary, hookFailure]);

    expect(composed.cause).toBe(primary);
    expect(composed.message).toBe(composeFailures([new Error(""), hookFailure]).message);
  });
});
