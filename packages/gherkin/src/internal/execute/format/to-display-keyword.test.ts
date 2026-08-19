import { describe, expect, test } from "vitest";
import { capture, errorShape } from "../../../__fixtures__/test-helpers.js";
import type { StepType } from "../../model/types.js";
import { toDisplayKeyword } from "./to-display-keyword.js";

describe("toDisplayKeyword", () => {
  test("should render a keyword from the resolved step type", () => {
    expect(toDisplayKeyword("Context")).toBe("Given");
    expect(toDisplayKeyword("Action")).toBe("When");
    expect(toDisplayKeyword("Outcome")).toBe("Then");
    expect(toDisplayKeyword("Unknown")).toBe("*");
  });

  test("should throw on a step type outside the union", () => {
    const error = capture(() => toDisplayKeyword("Bogus" as StepType));

    expect(error.code).toBe("model_invariant");
    expect(errorShape(error)).toMatchSnapshot();
  });
});
