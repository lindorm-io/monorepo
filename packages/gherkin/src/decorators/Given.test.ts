import { describe, expect, test } from "vitest";
import { capture, errorShape, metadataOf } from "../__fixtures__/test-helpers.js";
import { GherkinError } from "../errors/GherkinError.js";
import { STEPS_METADATA } from "../internal/metadata/symbols.js";
import { Given } from "./Given.js";

describe("Given", () => {
  test("should stage the expression string and method name in declaration order", () => {
    class KeySteps {
      @Given("an oct key")
      anOctKey(): void {}

      @Given("I encrypt {string}")
      iEncrypt(_content: string): void {}
    }

    expect(metadataOf(KeySteps)[STEPS_METADATA]).toEqual([
      { decorator: "Given", expression: "an oct key", methodName: "anOctKey" },
      { decorator: "Given", expression: "I encrypt {string}", methodName: "iEncrypt" },
    ]);
  });

  test("should throw scope_violation for a static method at decoration time", () => {
    const error = capture(() => {
      class Bad {
        @Given("a static step")
        static bad(): void {}
      }
      return Bad;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("scope_violation");
    expect(errorShape(error)).toMatchSnapshot();
  });
});
