import { describe, expect, test } from "vitest";
import { capture, errorShape, metadataOf } from "../__fixtures__/test-helpers.js";
import { GherkinError } from "../errors/GherkinError.js";
import { HOOKS_METADATA } from "../internal/metadata/symbols.js";
import { BeforeStep } from "./BeforeStep.js";

describe("BeforeStep", () => {
  test("should stage an instance hook", () => {
    class Hooks {
      @BeforeStep("@trace")
      trace(): void {}
    }

    expect(metadataOf(Hooks)[HOOKS_METADATA]).toEqual([
      { kind: "BeforeStep", methodName: "trace", static: false, tagExpression: "@trace" },
    ]);
  });

  test("should throw scope_violation for a static method at decoration time", () => {
    const error = capture(() => {
      class Bad {
        @BeforeStep()
        static bad(): void {}
      }
      return Bad;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("scope_violation");
    expect(errorShape(error)).toMatchSnapshot();
  });
});
