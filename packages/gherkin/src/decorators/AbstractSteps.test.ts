import { describe, expect, test } from "vitest";
import { capture, errorShape } from "../__fixtures__/test-helpers.js";
import { GherkinError } from "../errors/GherkinError.js";
import { ABSTRACT_STEPS_BRAND } from "../internal/metadata/symbols.js";
import { AbstractSteps } from "./AbstractSteps.js";
import { AfterScenario } from "./AfterScenario.js";
import { Given } from "./Given.js";
import { Inject } from "./Inject.js";
import { ParameterType } from "./ParameterType.js";
import { Priority } from "./Priority.js";

class AesContext {}

describe("AbstractSteps", () => {
  test("should brand a class carrying @Inject fields and plain helpers", () => {
    @AbstractSteps()
    abstract class Steps {
      @Inject(AesContext)
      protected aes!: AesContext;

      protected helper(): string {
        return "helper";
      }
    }

    expect(Object.hasOwn(Steps, ABSTRACT_STEPS_BRAND)).toEqual(true);
  });

  test("should brand a class with no decorated members at all", () => {
    @AbstractSteps()
    abstract class Steps {}

    expect(Object.hasOwn(Steps, ABSTRACT_STEPS_BRAND)).toEqual(true);
  });

  test("should throw abstract_base_declares_behaviour for a staged step, naming the member", () => {
    const error = capture(() => {
      @AbstractSteps()
      abstract class Bad {
        @Given("a shared step")
        sharedStep(): void {}
      }
      return Bad;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("abstract_base_declares_behaviour");
    expect(error.data).toEqual({
      className: "Bad",
      memberKind: "step",
      memberName: "sharedStep",
    });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should throw abstract_base_declares_behaviour for a staged hook, naming the member", () => {
    const error = capture(() => {
      @AbstractSteps()
      abstract class Bad {
        @AfterScenario()
        dump(): void {}
      }
      return Bad;
    });

    expect(error.code).toEqual("abstract_base_declares_behaviour");
    expect(error.data).toEqual({
      className: "Bad",
      memberKind: "hook",
      memberName: "dump",
    });
  });

  test("should throw abstract_base_declares_behaviour for a staged parameter type, naming the member", () => {
    const error = capture(() => {
      @AbstractSteps()
      abstract class Bad {
        @ParameterType("algorithm", /[A-Za-z0-9-]+/)
        static algorithm(raw: string): string {
          return raw;
        }
      }
      return Bad;
    });

    expect(error.code).toEqual("abstract_base_declares_behaviour");
    expect(error.data).toEqual({
      className: "Bad",
      memberKind: "parameter type",
      memberName: "algorithm",
    });
  });

  test("should throw abstract_base_declares_behaviour for a staged priority, naming the member", () => {
    // A @Priority can only modify a hook and hooks are refused here, so a
    // staged priority is always an orphan modifier.
    const error = capture(() => {
      @AbstractSteps()
      abstract class Bad {
        @Priority(1)
        helper(): void {}
      }
      return Bad;
    });

    expect(error.code).toEqual("abstract_base_declares_behaviour");
    expect(error.data).toEqual({
      className: "Bad",
      memberKind: "priority",
      memberName: "helper",
    });
  });

  test("should throw duplicate_abstract_steps when applied twice", () => {
    const error = capture(() => {
      @AbstractSteps()
      @AbstractSteps()
      abstract class Doubled {}
      return Doubled;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("duplicate_abstract_steps");
    expect(error.data).toEqual({ className: "Doubled" });
    expect(errorShape(error)).toMatchSnapshot();
  });
});
