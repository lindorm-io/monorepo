import { describe, expect, test } from "vitest";
import * as gherkin from "./index.js";

describe("index", () => {
  test("should export the public surface", () => {
    expect(Object.keys(gherkin).sort()).toMatchSnapshot();
  });

  test("should export the decorators and errors as values", () => {
    expect(gherkin.Binding).toBeTypeOf("function");
    expect(gherkin.Given).toBeTypeOf("function");
    expect(gherkin.When).toBeTypeOf("function");
    expect(gherkin.Then).toBeTypeOf("function");
    expect(gherkin.ParameterType).toBeTypeOf("function");
    expect(gherkin.GherkinError).toBeTypeOf("function");
    expect(gherkin.PendingStepError).toBeTypeOf("function");
  });
});
