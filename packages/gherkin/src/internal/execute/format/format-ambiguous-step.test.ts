import { describe, expect, test } from "vitest";
import type { StepModel } from "../../model/types.js";
import type { StepDefinition } from "../../registry/types.js";
import { formatAmbiguousStep } from "./format-ambiguous-step.js";

class AesEncryptionSteps {}
class AesKeyingSteps {}

const step: StepModel = {
  column: 5,
  hasArgument: false,
  line: 6,
  text: 'an oct key with encryption "A256GCM"',
  type: "Context",
};

const candidates: Array<StepDefinition> = [
  {
    className: "AesEncryptionSteps",
    decorator: "Given",
    expression: "an oct key with encryption {string}",
    methodName: "anOctKey",
    modulePath: "src/steps/aes.steps.ts",
    target: AesEncryptionSteps,
  },
  {
    className: "AesKeyingSteps",
    decorator: "When",
    expression: "an oct key with encryption {word}",
    methodName: "anOctKeyWithEnc",
    modulePath: "src/steps/keying.steps.ts",
    target: AesKeyingSteps,
  },
];

describe("formatAmbiguousStep", () => {
  test("should list every candidate with its authored decorator and module path", () => {
    const message = formatAmbiguousStep({
      candidates,
      remaining: 1,
      step,
      uri: "src/features/aes-encryption.feature",
    });

    expect(message).toContain("Ambiguous step");
    expect(message).toContain("at src/features/aes-encryption.feature:6:5");
    expect(message).toContain("2 step definitions matched:");
    // Labels pad to the widest candidate plus two separator spaces.
    expect(message).toContain(
      'AesEncryptionSteps.anOctKey     @Given("an oct key with encryption {string}")',
    );
    expect(message).toContain("    at src/steps/aes.steps.ts");
    expect(message).toContain(
      'AesKeyingSteps.anOctKeyWithEnc  @When("an oct key with encryption {word}")',
    );
    expect(message).toContain("Remove one, or make the expressions disjoint.");
    expect(message).toContain("The remaining 1 step in this scenario was skipped.");
    expect(message).toMatchSnapshot();
  });
});
