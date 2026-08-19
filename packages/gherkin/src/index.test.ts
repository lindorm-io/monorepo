import { describe, expect, test } from "vitest";
import * as gherkin from "./index.js";

describe("index", () => {
  test("should export the public surface", () => {
    expect(Object.keys(gherkin).sort()).toMatchSnapshot();
  });

  test("should export the decorators, classes and errors as values", () => {
    expect(gherkin.Binding).toBeTypeOf("function");
    expect(gherkin.Given).toBeTypeOf("function");
    expect(gherkin.When).toBeTypeOf("function");
    expect(gherkin.Then).toBeTypeOf("function");
    expect(gherkin.ParameterType).toBeTypeOf("function");
    expect(gherkin.GherkinError).toBeTypeOf("function");
    expect(gherkin.PendingStepError).toBeTypeOf("function");
    expect(gherkin.ScenarioInfo).toBeTypeOf("function");
  });

  test("should export the lifecycle decorators — the runtime executes hooks now", () => {
    // The chunk-7 holdback is lifted: every one of these is wired into
    // run-scenario.ts / feature-hooks.ts, so none is a silent no-op.
    expect(gherkin.AbstractSteps).toBeTypeOf("function");
    expect(gherkin.AfterFeature).toBeTypeOf("function");
    expect(gherkin.AfterScenario).toBeTypeOf("function");
    expect(gherkin.AfterStep).toBeTypeOf("function");
    expect(gherkin.BeforeFeature).toBeTypeOf("function");
    expect(gherkin.BeforeScenario).toBeTypeOf("function");
    expect(gherkin.BeforeStep).toBeTypeOf("function");
    expect(gherkin.Context).toBeTypeOf("function");
    expect(gherkin.Inject).toBeTypeOf("function");
    expect(gherkin.Priority).toBeTypeOf("function");
  });
});
