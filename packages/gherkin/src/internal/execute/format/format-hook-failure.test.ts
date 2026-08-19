import { describe, expect, test } from "vitest";
import { formatHookFailure } from "./format-hook-failure.js";

describe("formatHookFailure", () => {
  test("should name the kind, carry the anchor and preserve the message verbatim", () => {
    const message = formatHookFailure({
      anchor: "  AesHooks.seed\n  at src/features/aes.feature:4:3",
      kind: "BeforeScenario",
      message: "docker is not running",
      remaining: 3,
    });

    expect(message).toContain("@BeforeScenario hook failed");
    expect(message).toContain("  AesHooks.seed");
    expect(message).toContain("docker is not running");
    expect(message).toContain("The remaining 3 steps in this scenario were skipped.");
    expect(message).toMatchSnapshot();
  });

  test("should omit the skipped line when remaining is absent — after-the-fact hooks skip nothing", () => {
    const message = formatHookFailure({
      anchor: "  AesHooks.report\n  at src/features/aes.feature:4:3",
      kind: "AfterScenario",
      message: "report upload failed",
    });

    expect(message).not.toContain("skipped");
    expect(message).toMatchSnapshot();
  });
});
