import type { Constructor } from "@lindorm/types";
import { describe, expect, test } from "vitest";
import type { ComposedHook } from "../metadata/staged.js";
import { orderHooks } from "./order-hooks.js";
import type { BindingRegistration } from "./registrations.js";
import type { StepModule } from "./types.js";

const Target = class {} as Constructor;

const registration = (
  className: string,
  hooks: Array<ComposedHook>,
): BindingRegistration => ({
  className,
  hooks,
  injects: [],
  parameterTypes: [],
  steps: [],
  target: Target,
});

const stepModule = (
  modulePath: string,
  registrations: Array<BindingRegistration>,
): StepModule => ({ modulePath, registrations });

describe("orderHooks", () => {
  test("should order by priority ascending across modules, regardless of load order", () => {
    const hooks = orderHooks([
      stepModule("src/a.steps.ts", [
        registration("A", [
          { kind: "BeforeScenario", methodName: "late", priority: 200, static: false },
        ]),
      ]),
      stepModule("src/b.steps.ts", [
        registration("B", [
          { kind: "BeforeScenario", methodName: "early", priority: 100, static: false },
        ]),
      ]),
    ]);

    expect(hooks.BeforeScenario.map((hook) => hook.methodName)).toEqual([
      "early",
      "late",
    ]);
  });

  test("should break priority ties by module path ascending", () => {
    // Handed in DESCENDING path order — the tiebreak must not depend on the
    // caller's ordering.
    const hooks = orderHooks([
      stepModule("src/z.steps.ts", [
        registration("Z", [
          { kind: "BeforeScenario", methodName: "fromZ", priority: 100, static: false },
        ]),
      ]),
      stepModule("src/a.steps.ts", [
        registration("A", [
          { kind: "BeforeScenario", methodName: "fromA", priority: 100, static: false },
        ]),
      ]),
      stepModule("src/m.steps.ts", [
        registration("M", [
          { kind: "BeforeScenario", methodName: "fromM", priority: 100, static: false },
        ]),
      ]),
    ]);

    expect(hooks.BeforeScenario.map((hook) => hook.methodName)).toEqual([
      "fromA",
      "fromM",
      "fromZ",
    ]);
  });

  test("should keep declaration order within one module as the final tiebreak", () => {
    // Names deliberately ANTI-alphabetical (zebra before alpha, Z before A):
    // a methodName or className tiebreak sneaking into the comparator flips
    // this order and fails the test.
    const hooks = orderHooks([
      stepModule("src/a.steps.ts", [
        registration("ZDeclaredFirst", [
          { kind: "AfterScenario", methodName: "zebra", priority: 100, static: false },
        ]),
        registration("ADeclaredSecond", [
          { kind: "AfterScenario", methodName: "alpha", priority: 100, static: false },
        ]),
      ]),
    ]);

    expect(hooks.AfterScenario.map((hook) => hook.methodName)).toEqual([
      "zebra",
      "alpha",
    ]);
  });

  test("should group by kind, every kind ASCENDING — After* reversal belongs to the runner", () => {
    const composed: Array<ComposedHook> = [
      { kind: "BeforeFeature", methodName: "bf", priority: 2, static: true },
      { kind: "AfterFeature", methodName: "af2", priority: 2, static: true },
      { kind: "AfterFeature", methodName: "af1", priority: 1, static: true },
      { kind: "BeforeScenario", methodName: "bs", priority: 1, static: false },
      { kind: "AfterScenario", methodName: "as", priority: 1, static: false },
      { kind: "BeforeStep", methodName: "bst", priority: 1, static: false },
      { kind: "AfterStep", methodName: "ast", priority: 1, static: false },
    ];

    const hooks = orderHooks([
      stepModule("src/a.steps.ts", [registration("Hooks", composed)]),
    ]);

    expect(hooks).toMatchSnapshot();
    // The catalogue itself serves After* ascending too.
    expect(hooks.AfterFeature.map((hook) => hook.methodName)).toEqual(["af1", "af2"]);
  });

  test("should carry class, target, module path, static flag and tag expression through", () => {
    const hooks = orderHooks([
      stepModule("src/a.steps.ts", [
        registration("Hooks", [
          {
            kind: "BeforeFeature",
            methodName: "start",
            priority: 10_000,
            static: true,
            tagExpression: "@docker",
          },
        ]),
      ]),
    ]);

    expect(hooks.BeforeFeature).toEqual([
      {
        className: "Hooks",
        injects: [],
        kind: "BeforeFeature",
        matches: expect.any(Function),
        methodName: "start",
        modulePath: "src/a.steps.ts",
        priority: 10_000,
        static: true,
        tagExpression: "@docker",
        target: Target,
      },
    ]);
  });

  test("should compile the tag expression into a matcher evaluating @-prefixed tags", () => {
    const hooks = orderHooks([
      stepModule("src/a.steps.ts", [
        registration("Hooks", [
          {
            kind: "BeforeScenario",
            methodName: "tagged",
            priority: 10_000,
            static: false,
            tagExpression: "@docker and not @slow",
          },
          {
            kind: "BeforeScenario",
            methodName: "always",
            priority: 10_000,
            static: false,
          },
        ]),
      ]),
    ]);

    const [tagged, always] = hooks.BeforeScenario;

    expect(tagged.matches(["@docker"])).toBe(true);
    expect(tagged.matches(["@docker", "@slow"])).toBe(false);
    // Tags evaluate WITH the @ prefix — the model stores them as authored.
    expect(tagged.matches(["docker"])).toBe(false);
    // Absent expression = always runs.
    expect(always.matches([])).toBe(true);
  });

  test("should throw invalid_tag_expression at registry build, anchored to the declaration", () => {
    expect(() =>
      orderHooks([
        stepModule("src/a.steps.ts", [
          registration("Hooks", [
            {
              kind: "BeforeScenario",
              methodName: "broken",
              priority: 10_000,
              static: false,
              tagExpression: "@a and (",
            },
          ]),
        ]),
      ]),
    ).toThrow('Invalid tag expression "@a and (" on Hooks.broken');
  });
});
