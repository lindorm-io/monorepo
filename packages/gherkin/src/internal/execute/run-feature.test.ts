import { beforeEach, describe, expect, test } from "vitest";
import { createFakeSuiteApi } from "../../__fixtures__/suite-api.js";
import { captureAsync } from "../../__fixtures__/test-helpers.js";
import { Binding } from "../../decorators/Binding.js";
import { Given } from "../../decorators/Given.js";
import { ParameterType } from "../../decorators/ParameterType.js";
import { buildFeatureModel } from "../model/build-feature-model.js";
import { drainRegistrations } from "../registry/registrations.js";
import { runFeature } from "./run-feature.js";

const executed: Array<string> = [];

// Classes are defined INSIDE the thunks: decoration is an import-time side
// effect, so defining them at module scope would register them before
// runFeature drains — misattributing them to the first module loaded.
const stepModules = {
  "src/flow.steps.ts": async (): Promise<unknown> => {
    @Binding()
    class FlowSteps {
      @Given("I run {string}")
      run(value: string): void {
        executed.push(value);
      }
    }
    return FlowSteps;
  },
};

const source = [
  "Feature: full flow",
  "",
  "  Scenario Outline: runs <value>",
  '    Given I run "<value>"',
  "",
  "    Examples:",
  "      | value |",
  "      | a     |",
  "      | b     |",
  "",
  "  Rule: grouped",
  "",
  "    Scenario: runs one and two",
  '      Given I run "one"',
  '      Given I run "two"',
].join("\n");

describe("runFeature", () => {
  beforeEach(() => {
    executed.length = 0;
    drainRegistrations();
  });

  test("should load modules, build the registry and emit the whole suite", async () => {
    const fake = createFakeSuiteApi();

    await runFeature({
      api: fake.api,
      model: buildFeatureModel(source, "src/features/flow.feature"),
      stepModules,
    });

    expect(fake.suites.map(({ mode, name }) => ({ mode, name }))).toEqual([
      { mode: "normal", name: "full flow" },
      { mode: "normal", name: "grouped" },
      { mode: "skip", name: "gherkin structural invariant" },
    ]);
    expect(fake.tests.map((entry) => entry.name)).toEqual([
      "runs a",
      "runs b",
      "runs one and two",
    ]);

    for (const entry of fake.tests) {
      await entry.body();
    }

    expect(executed).toEqual(["a", "b", "one", "two"]);
  });

  test("should propagate a broken step module and emit nothing", async () => {
    const fake = createFakeSuiteApi();

    await expect(
      runFeature({
        api: fake.api,
        model: buildFeatureModel(source, "src/features/flow.feature"),
        stepModules: {
          "src/broken.steps.ts": async () => {
            throw new Error("broken step module");
          },
        },
      }),
    ).rejects.toThrow("broken step module");

    expect(fake.suites).toEqual([]);
    expect(fake.tests).toEqual([]);
  });

  test("should propagate a registry-build error for every model kind alike", async () => {
    const fake = createFakeSuiteApi();

    // A duplicate of the built-in {string} fails registry build — and it must
    // fail even a file whose own model is EMPTY, because the flat namespace
    // makes broken step definitions everyone's problem.
    const error = await captureAsync(() =>
      runFeature({
        api: fake.api,
        model: buildFeatureModel("Feature: empty", "src/features/empty.feature"),
        stepModules: {
          "src/dup.steps.ts": async (): Promise<unknown> => {
            @Binding()
            class DupSteps {
              @ParameterType("string", /\w+/)
              static string(raw: string): string {
                return raw;
              }
            }
            return DupSteps;
          },
        },
      }),
    );

    expect(error.code).toBe("duplicate_parameter_type");
    expect(fake.suites).toEqual([]);
  });
});
