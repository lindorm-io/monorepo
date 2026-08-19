import { describe, expect, test } from "vitest";
import { capture, errorShape } from "../__fixtures__/test-helpers.js";
import { GherkinError } from "../errors/GherkinError.js";
import { DEFAULT_HOOK_PRIORITY, composeHooks } from "./compose-hooks.js";

describe("composeHooks", () => {
  test("should default an unprioritized hook to 10 000", () => {
    expect(DEFAULT_HOOK_PRIORITY).toEqual(10_000);
    expect(
      composeHooks(
        "Hooks",
        [{ kind: "BeforeScenario", methodName: "seed", static: false }],
        [],
      ),
    ).toEqual([
      { kind: "BeforeScenario", methodName: "seed", priority: 10_000, static: false },
    ]);
  });

  test("should join priorities by the compound key — same-name static and instance hooks stay separate", () => {
    expect(
      composeHooks(
        "Hooks",
        [
          { kind: "BeforeFeature", methodName: "setup", static: true },
          { kind: "BeforeScenario", methodName: "setup", static: false },
        ],
        [
          { key: "true:setup", methodName: "setup", priority: 1, static: true },
          { key: "false:setup", methodName: "setup", priority: 999, static: false },
        ],
      ),
    ).toEqual([
      { kind: "BeforeFeature", methodName: "setup", priority: 1, static: true },
      { kind: "BeforeScenario", methodName: "setup", priority: 999, static: false },
    ]);
  });

  test("should throw priority_without_hook for a priority no hook consumes", () => {
    const error = capture(() =>
      composeHooks(
        "Hooks",
        [{ kind: "BeforeScenario", methodName: "seed", static: false }],
        [{ key: "false:step", methodName: "step", priority: 5, static: false }],
      ),
    );

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("priority_without_hook");
    expect(error.data).toEqual({ className: "Hooks", method: "step", static: false });
    expect(errorShape(error)).toMatchSnapshot();
  });
});
