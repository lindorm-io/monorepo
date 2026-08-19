import { describe, expect, test } from "vitest";
import { capture, errorShape } from "../../__fixtures__/test-helpers.js";
import { compileTagExpression } from "./compile-tag-expression.js";

const declaration = {
  className: "LifecycleHooks",
  methodName: "startDocker",
  modulePath: "src/lifecycle.steps.ts",
};

describe("compileTagExpression", () => {
  test("should always match when no expression is given", () => {
    const matches = compileTagExpression(declaration);

    expect(matches([])).toBe(true);
    expect(matches(["@anything"])).toBe(true);
  });

  test("should evaluate and/or/not with parentheses", () => {
    const matches = compileTagExpression({
      ...declaration,
      tagExpression: "@docker and (@fast or not @slow)",
    });

    expect(matches(["@docker"])).toBe(true);
    expect(matches(["@docker", "@slow"])).toBe(false);
    expect(matches(["@docker", "@slow", "@fast"])).toBe(true);
    expect(matches([])).toBe(false);
  });

  test("should evaluate tags WITH the @ prefix — the model's authored spelling", () => {
    const matches = compileTagExpression({ ...declaration, tagExpression: "@wip" });

    expect(matches(["@wip"])).toBe(true);
    // A stripped tag never matches — probed on @cucumber/tag-expressions 11.0.1.
    expect(matches(["wip"])).toBe(false);
  });

  test("should throw invalid_tag_expression for a malformed expression, anchored to the declaration", () => {
    const error = capture(() =>
      compileTagExpression({ ...declaration, tagExpression: "@a and (" }),
    );

    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should anchor an adjacent-tags syntax error the same way", () => {
    const error = capture(() =>
      compileTagExpression({ ...declaration, tagExpression: "@a @b" }),
    );

    expect(error.code).toBe("invalid_tag_expression");
    expect(error.message).toContain('Invalid tag expression "@a @b"');
    expect(error.message).toContain("LifecycleHooks.startDocker");
  });
});
