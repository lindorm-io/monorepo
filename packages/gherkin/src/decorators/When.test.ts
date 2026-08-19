import { describe, expect, test } from "vitest";
import { metadataOf } from "../__fixtures__/test-helpers.js";
import { STEPS_METADATA } from "../internal/metadata/symbols.js";
import { Given } from "./Given.js";
import { When } from "./When.js";

describe("When", () => {
  test("should stage into the same steps array as Given — the keyword has no matching significance", () => {
    class Steps {
      @Given("a key is loaded")
      given(): void {}

      @When("I encrypt {string}")
      when(_content: string): void {}
    }

    expect(metadataOf(Steps)[STEPS_METADATA]).toEqual([
      { decorator: "Given", expression: "a key is loaded", methodName: "given" },
      { decorator: "When", expression: "I encrypt {string}", methodName: "when" },
    ]);
  });
});
