import { describe, expect, test } from "vitest";
import { capture, errorShape, metadataOf } from "../__fixtures__/test-helpers.js";
import { GherkinError } from "../errors/GherkinError.js";
import { HOOKS_METADATA } from "../internal/metadata/symbols.js";
import { BeforeScenario } from "./BeforeScenario.js";

describe("BeforeScenario", () => {
  test("should stage an instance hook with and without a tag expression", () => {
    class Hooks {
      @BeforeScenario()
      seed(): void {}

      @BeforeScenario("@integration and not @slow")
      seedTagged(): void {}
    }

    expect(metadataOf(Hooks)[HOOKS_METADATA]).toEqual([
      { kind: "BeforeScenario", methodName: "seed", static: false },
      {
        kind: "BeforeScenario",
        methodName: "seedTagged",
        static: false,
        tagExpression: "@integration and not @slow",
      },
    ]);
  });

  test("should throw scope_violation for a static method at decoration time", () => {
    const error = capture(() => {
      class Bad {
        @BeforeScenario()
        static bad(): void {}
      }
      return Bad;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("scope_violation");
    expect(error.data).toEqual({ hook: "BeforeScenario", method: "bad" });
    expect(errorShape(error)).toMatchSnapshot();
  });
});
