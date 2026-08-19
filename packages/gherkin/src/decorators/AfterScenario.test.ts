import { describe, expect, test } from "vitest";
import { capture, errorShape, metadataOf } from "../__fixtures__/test-helpers.js";
import { GherkinError } from "../errors/GherkinError.js";
import { HOOKS_METADATA } from "../internal/metadata/symbols.js";
import { AfterScenario } from "./AfterScenario.js";

describe("AfterScenario", () => {
  test("should stage an instance hook", () => {
    class Hooks {
      @AfterScenario()
      dump(): void {}
    }

    expect(metadataOf(Hooks)[HOOKS_METADATA]).toEqual([
      { kind: "AfterScenario", methodName: "dump", static: false },
    ]);
  });

  test("should throw scope_violation for a static method at decoration time", () => {
    const error = capture(() => {
      class Bad {
        @AfterScenario()
        static bad(): void {}
      }
      return Bad;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("scope_violation");
    expect(errorShape(error)).toMatchSnapshot();
  });
});
