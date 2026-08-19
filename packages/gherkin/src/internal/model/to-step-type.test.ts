import { PickleStepType } from "@cucumber/messages";
import { describe, expect, test } from "vitest";
import { capture, errorShape } from "../../__fixtures__/test-helpers.js";
import { toStepType } from "./to-step-type.js";

describe("toStepType", () => {
  test("should map every resolved pickle step type", () => {
    expect(toStepType(PickleStepType.CONTEXT)).toBe("Context");
    expect(toStepType(PickleStepType.ACTION)).toBe("Action");
    expect(toStepType(PickleStepType.OUTCOME)).toBe("Outcome");
    expect(toStepType(PickleStepType.UNKNOWN)).toBe("Unknown");
  });

  test("should throw on an unresolved (undefined) type", () => {
    const error = capture(() => toStepType(undefined));

    expect(error.code).toBe("model_invariant");
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should throw on an unmapped enum value", () => {
    const error = capture(() => toStepType("Bogus" as PickleStepType));

    expect(error.code).toBe("model_invariant");
    expect(errorShape(error)).toMatchSnapshot();
  });
});
