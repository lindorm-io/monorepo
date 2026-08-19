import { describe, expect, test } from "vitest";
import { metadataOf } from "../__fixtures__/test-helpers.js";
import { STEPS_METADATA } from "../internal/metadata/symbols.js";
import { Then } from "./Then.js";

describe("Then", () => {
  test("should stage the expression string and method name", () => {
    class Steps {
      @Then("decrypting returns {string}")
      decryptingReturns(_expected: string): void {}
    }

    expect(metadataOf(Steps)[STEPS_METADATA]).toEqual([
      {
        decorator: "Then",
        expression: "decrypting returns {string}",
        methodName: "decryptingReturns",
      },
    ]);
  });
});
