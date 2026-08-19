import { describe, expect, test } from "vitest";
import { capture, errorShape } from "../../../__fixtures__/test-helpers.js";
import type { StepType } from "../../model/types.js";
import { toSnippetDecorator } from "./to-snippet-decorator.js";

describe("toSnippetDecorator", () => {
  test("should map step types to decorators, Unknown falling back to Given", () => {
    expect(toSnippetDecorator("Context")).toBe("Given");
    expect(toSnippetDecorator("Action")).toBe("When");
    expect(toSnippetDecorator("Outcome")).toBe("Then");
    expect(toSnippetDecorator("Unknown")).toBe("Given");
  });

  test("should throw on a step type outside the union", () => {
    const error = capture(() => toSnippetDecorator("Bogus" as StepType));

    expect(error.code).toBe("model_invariant");
    expect(errorShape(error)).toMatchSnapshot();
  });
});
