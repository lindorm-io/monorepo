import { describe, expect, test } from "vitest";
import { capture, errorShape } from "../../__fixtures__/test-helpers.js";
import { requireStepLocation } from "./step-location-index.js";

// buildStepLocationIndex is pinned end-to-end in build-feature-model.test.ts —
// every asserted step line and column (feature background, rule background,
// scenario) resolves through it.
describe("requireStepLocation", () => {
  test("should return the indexed location", () => {
    expect(requireStepLocation(new Map([["4", { column: 5, line: 12 }]]), "4")).toEqual({
      column: 5,
      line: 12,
    });
  });

  test("should throw when the pickle step points at no AST step", () => {
    const error = capture(() => requireStepLocation(new Map(), "missing"));

    expect(error.code).toBe("model_invariant");
    expect(errorShape(error)).toMatchSnapshot();
  });
});
