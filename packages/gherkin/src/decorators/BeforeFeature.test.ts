import { describe, expect, test } from "vitest";
import { capture, errorShape, metadataOf } from "../__fixtures__/test-helpers.js";
import { GherkinError } from "../errors/GherkinError.js";
import { HOOKS_METADATA } from "../internal/metadata/symbols.js";
import { BeforeFeature } from "./BeforeFeature.js";

describe("BeforeFeature", () => {
  test("should stage a static hook with and without a tag expression, in declaration order", () => {
    class Hooks {
      @BeforeFeature()
      static start(): void {}

      @BeforeFeature("@integration")
      static startTagged(): void {}
    }

    expect(metadataOf(Hooks)[HOOKS_METADATA]).toEqual([
      { kind: "BeforeFeature", methodName: "start", static: true },
      {
        kind: "BeforeFeature",
        methodName: "startTagged",
        static: true,
        tagExpression: "@integration",
      },
    ]);
  });

  test("should throw scope_violation for an instance method at decoration time", () => {
    const error = capture(() => {
      class Bad {
        @BeforeFeature()
        bad(): void {}
      }
      return Bad;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("scope_violation");
    expect(error.data).toEqual({ hook: "BeforeFeature", method: "bad" });
    expect(errorShape(error)).toMatchSnapshot();
  });
});
