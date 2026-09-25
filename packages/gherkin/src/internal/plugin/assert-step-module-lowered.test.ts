import { describe, expect, test } from "vitest";
import { capture, errorShape } from "../../__fixtures__/test-helpers.js";
import { assertStepModuleLowered } from "./assert-step-module-lowered.js";

const URI = "src/greeting.steps.ts";

describe("assertStepModuleLowered", () => {
  describe("code the pipeline lowered", () => {
    test("should stay silent on tsc's __esDecorate output", () => {
      expect(() =>
        assertStepModuleLowered({
          code: [
            "let GreetingSteps = (() => {",
            "  let _step_decorators;",
            "  return class GreetingSteps {",
            '    static { __esDecorate(this, null, _step_decorators, { kind: "method", name: "step" }, null, []); }',
            "    step() {}",
            "  };",
            "})();",
            "export { GreetingSteps };",
          ].join("\n"),
          uri: URI,
        }),
      ).not.toThrow();
    });

    test("should stay silent on swc's _ts_decorate output", () => {
      expect(() =>
        assertStepModuleLowered({
          code: [
            "function _ts_decorate(decorators, target) { return target; }",
            "let GreetingSteps = class GreetingSteps { step() {} };",
            "GreetingSteps = _ts_decorate([], GreetingSteps);",
            "export { GreetingSteps };",
          ].join("\n"),
          uri: URI,
        }),
      ).not.toThrow();
    });

    test("should stay silent on a module that only MENTIONS a decorator in a string", () => {
      expect(() =>
        assertStepModuleLowered({
          code: [
            "export const snippet = '@Given(\"a step\")';",
            'export const kind = { type: "Decorator" };',
            "export const steps = [];",
          ].join("\n"),
          uri: URI,
        }),
      ).not.toThrow();
    });

    test("should stay silent on a module with nothing in it", () => {
      expect(() =>
        assertStepModuleLowered({ code: "export {};\n", uri: URI }),
      ).not.toThrow();
    });
  });

  describe("a decorator that survived", () => {
    test("should refuse a decorated method", () => {
      const error = capture(() =>
        assertStepModuleLowered({
          code: [
            "export class GreetingSteps {",
            '  @Given("a step")',
            "  step() {}",
            "}",
          ].join("\n"),
          uri: URI,
        }),
      );

      expect(errorShape(error)).toMatchSnapshot();
    });

    test("should refuse a decorated class declaration", () => {
      const error = capture(() =>
        assertStepModuleLowered({
          code: ["@Binding()", "export class GreetingSteps {}"].join("\n"),
          uri: URI,
        }),
      );

      expect(error.code).toBe("step_module_not_lowered");
    });

    test("should refuse a decorated class nested inside a function body", () => {
      const error = capture(() =>
        assertStepModuleLowered({
          code: [
            "export const define = () => {",
            "  return class GreetingSteps {",
            '    @Given("a step")',
            "    step() {}",
            "  };",
            "};",
          ].join("\n"),
          uri: URI,
        }),
      );

      expect(error.code).toBe("step_module_not_lowered");
    });

    test("should name the step module and carry it as the id vite prints as File", () => {
      const error = capture(() =>
        assertStepModuleLowered({
          code: '@Binding() export class GreetingSteps { @Given("a step") step() {} }',
          uri: URI,
        }),
      );

      expect(error.message).toContain(URI);
      expect(error.data).toEqual({ uri: URI });
      expect(error.id).toBe(URI);
    });
  });

  describe("code the pipeline never compiled", () => {
    test("should refuse TypeScript that reached the runtime untransformed", () => {
      const error = capture(() =>
        assertStepModuleLowered({
          code: [
            "export class GreetingSteps {",
            '  @Given("a step")',
            "  step(): void {}",
            "}",
          ].join("\n"),
          uri: URI,
        }),
      );

      expect(errorShape(error)).toMatchSnapshot();
    });

    test("should keep the parser's own message and carry the uri as the id", () => {
      const error = capture(() =>
        assertStepModuleLowered({
          code: "export const greeting: string = 'hello';\n",
          uri: URI,
        }),
      );

      expect(error.code).toBe("step_module_not_compiled");
      expect(error.errors.join("\n")).toContain("Parse failed");
      expect(error.id).toBe(URI);
    });
  });
});
