import { describe, expect, test } from "vitest";
import type { ScenarioNode, StepModel } from "../../model/types.js";
import {
  formatFeatureHookAnchor,
  formatScenarioHookAnchor,
  formatStepHookAnchor,
} from "./format-hook-anchor.js";

const scenario: ScenarioNode = {
  kind: "scenario",
  column: 3,
  line: 4,
  name: "record mode binds the AAD",
  steps: [],
  tags: [],
};

const step: StepModel = {
  column: 5,
  hasArgument: false,
  line: 6,
  text: "an oct key",
  type: "Context",
};

describe("formatFeatureHookAnchor", () => {
  test("should name the hook and the feature file without a line", () => {
    expect(
      formatFeatureHookAnchor("AesHooks", "startDocker", "src/features/aes.feature"),
    ).toMatchSnapshot();
  });
});

describe("formatScenarioHookAnchor", () => {
  test("should anchor the hook to the scenario's own line and column", () => {
    expect(
      formatScenarioHookAnchor("AesHooks", "seed", scenario, "src/features/aes.feature"),
    ).toMatchSnapshot();
  });
});

describe("formatStepHookAnchor", () => {
  test("should name the hook above the step it bracketed", () => {
    expect(
      formatStepHookAnchor("AesHooks", "capture", step, "src/features/aes.feature"),
    ).toMatchSnapshot();
  });
});
