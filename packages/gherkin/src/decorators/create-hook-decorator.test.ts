import { describe, expect, test } from "vitest";
import { capture, errorShape, metadataOf } from "../__fixtures__/test-helpers.js";
import { GherkinError } from "../errors/GherkinError.js";
import { HOOKS_METADATA } from "../internal/metadata/symbols.js";
import { AfterScenario } from "./AfterScenario.js";
import { BeforeScenario } from "./BeforeScenario.js";

describe("createHookDecorator", () => {
  test("should throw duplicate_hook for the same kind twice on one method, tag expressions notwithstanding", () => {
    const error = capture(() => {
      class Bad {
        @BeforeScenario("@integration")
        @BeforeScenario("@docker")
        seed(): void {}
      }
      return Bad;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("duplicate_hook");
    expect(error.data).toEqual({ hook: "BeforeScenario", method: "seed" });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should allow CROSS-kind stacking on one method", () => {
    class Hooks {
      @BeforeScenario()
      @AfterScenario()
      bracket(): void {}
    }

    expect(metadataOf(Hooks)[HOOKS_METADATA]).toEqual([
      { kind: "AfterScenario", methodName: "bracket", static: false },
      { kind: "BeforeScenario", methodName: "bracket", static: false },
    ]);
  });

  test("should allow the same kind on two DIFFERENT methods", () => {
    class Hooks {
      @BeforeScenario()
      first(): void {}

      @BeforeScenario()
      second(): void {}
    }

    expect(metadataOf(Hooks)[HOOKS_METADATA]).toEqual([
      { kind: "BeforeScenario", methodName: "first", static: false },
      { kind: "BeforeScenario", methodName: "second", static: false },
    ]);
  });
});
