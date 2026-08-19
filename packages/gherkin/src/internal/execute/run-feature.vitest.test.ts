// End-to-end over vitest's REAL describe/test: runFeature is awaited at
// MODULE level (the exact shape the emitter chunk generates), so the emitted
// scenarios collect and RUN as real tests in this very file. This pins, on
// the real api: the default-api branch, that emitted scenarios actually
// execute their steps, that the structural-invariant trailer collects
// without dying, and that an EMPTY model's empty describe.skip is legal —
// if any of that regressed, this file fails collection or goes red.
import { expect, test } from "vitest";
import { Binding, Given } from "../../index.js";
import { runFeature } from "../../runtime.js";
import { buildFeatureModel } from "../model/build-feature-model.js";

const executed: Array<string> = [];

const source = [
  "Feature: real vitest emission",
  "",
  "  Scenario Outline: emits <value>",
  '    Given the real api runs "<value>"',
  "",
  "    Examples:",
  "      | value |",
  "      | a     |",
  "      | b     |",
  "",
  "  Rule: grouped",
  "",
  "    Scenario: emits one and two",
  '      Given the real api runs "one"',
  '      Given the real api runs "two"',
].join("\n");

await runFeature({
  model: buildFeatureModel(source, "src/features/real.feature"),
  stepModules: {
    "src/real.steps.ts": async (): Promise<unknown> => {
      @Binding()
      class RealApiSteps {
        @Given("the real api runs {string}")
        run(value: string): void {
          executed.push(value);
        }
      }
      return RealApiSteps;
    },
  },
});

await runFeature({
  model: buildFeatureModel(
    "Feature: empty on the real api",
    "src/features/empty.feature",
  ),
  stepModules: {},
});

// Registered after the emitted suites, so it runs after every emitted
// scenario — proving they executed rather than silently collected.
test("the emitted scenarios executed their steps through the real vitest api", () => {
  expect(executed).toEqual(["a", "b", "one", "two"]);
});
