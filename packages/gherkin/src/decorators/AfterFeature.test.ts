import { describe, expect, test } from "vitest";
import { capture, errorShape, metadataOf } from "../__fixtures__/test-helpers.js";
import { GherkinError } from "../errors/GherkinError.js";
import { HOOKS_METADATA } from "../internal/metadata/symbols.js";
import { AfterFeature } from "./AfterFeature.js";

describe("AfterFeature", () => {
  test("should stage a static hook", () => {
    class Hooks {
      @AfterFeature("@docker")
      static stop(): void {}
    }

    expect(metadataOf(Hooks)[HOOKS_METADATA]).toEqual([
      {
        kind: "AfterFeature",
        methodName: "stop",
        static: true,
        tagExpression: "@docker",
      },
    ]);
  });

  test("should throw scope_violation for an instance method at decoration time", () => {
    const error = capture(() => {
      class Bad {
        @AfterFeature()
        bad(): void {}
      }
      return Bad;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("scope_violation");
    expect(errorShape(error)).toMatchSnapshot();
  });
});
