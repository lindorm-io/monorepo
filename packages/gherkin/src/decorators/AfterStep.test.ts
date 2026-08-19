import { describe, expect, test } from "vitest";
import { capture, errorShape, metadataOf } from "../__fixtures__/test-helpers.js";
import { GherkinError } from "../errors/GherkinError.js";
import { HOOKS_METADATA } from "../internal/metadata/symbols.js";
import { AfterStep } from "./AfterStep.js";

describe("AfterStep", () => {
  test("should stage an instance hook", () => {
    class Hooks {
      @AfterStep()
      capture(): void {}
    }

    expect(metadataOf(Hooks)[HOOKS_METADATA]).toEqual([
      { kind: "AfterStep", methodName: "capture", static: false },
    ]);
  });

  test("should throw scope_violation for a static method at decoration time", () => {
    const error = capture(() => {
      class Bad {
        @AfterStep()
        static bad(): void {}
      }
      return Bad;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("scope_violation");
    expect(errorShape(error)).toMatchSnapshot();
  });
});
