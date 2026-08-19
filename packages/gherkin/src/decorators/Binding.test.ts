import { beforeEach, describe, expect, test } from "vitest";
import { capture, errorShape, metadataOf } from "../__fixtures__/test-helpers.js";
import { GherkinError } from "../errors/GherkinError.js";
import { STEPS_METADATA } from "../internal/metadata/symbols.js";
import { drainRegistrations } from "../internal/registry/registrations.js";
import { Binding } from "./Binding.js";
import { Given } from "./Given.js";
import { ParameterType } from "./ParameterType.js";

describe("Binding", () => {
  beforeEach(() => {
    drainRegistrations();
  });

  test("should register the class with its own staged steps and parameter types", () => {
    @Binding()
    class AesSteps {
      @Given("an oct key")
      anOctKey(): void {}

      @ParameterType("algorithm", /[A-Za-z0-9-]+/)
      static algorithm(raw: string): string {
        return raw;
      }
    }

    const registrations = drainRegistrations();

    expect(registrations).toEqual([
      {
        className: "AesSteps",
        parameterTypes: [
          {
            methodName: "algorithm",
            name: "algorithm",
            options: {},
            regexp: /[A-Za-z0-9-]+/,
            transform: expect.any(Function),
          },
        ],
        steps: [{ decorator: "Given", expression: "an oct key", methodName: "anOctKey" }],
        target: AesSteps,
      },
    ]);
  });

  test("should register empty arrays for a class with no staged members", () => {
    @Binding()
    class EmptySteps {}

    expect(drainRegistrations()).toEqual([
      { className: "EmptySteps", parameterTypes: [], steps: [], target: EmptySteps },
    ]);
  });

  test("should allow extending a plain undecorated helper base", () => {
    class Helper {
      helper(): string {
        return "helper";
      }
    }

    @Binding()
    class Steps extends Helper {
      @Given("a step")
      step(): void {}
    }

    expect(drainRegistrations().map((entry) => entry.className)).toEqual(["Steps"]);
    expect(new Steps().helper()).toEqual("helper");
  });

  test("should throw inheritance_forbidden when a @Binding class extends a @Binding class", () => {
    @Binding()
    class Base {
      @Given("a base step")
      base(): void {}
    }
    drainRegistrations();

    const error = capture(() => {
      @Binding()
      class Leaf extends Base {}
      return Leaf;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("inheritance_forbidden");
    expect(error.data).toEqual({ child: "Leaf", parent: "Base" });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should throw duplicate_binding when @Binding is applied twice", () => {
    const error = capture(() => {
      @Binding()
      @Binding()
      class Twice {
        @Given("a step")
        step(): void {}
      }
      return Twice;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("duplicate_binding");
    expect(error.data).toEqual({ className: "Twice" });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should name the branded ancestor through an undecorated intermediate class", () => {
    @Binding()
    class Grand {}
    drainRegistrations();

    class Mid extends Grand {}

    const error = capture(() => {
      @Binding()
      class Leaf extends Mid {}
      return Leaf;
    });

    expect(error.code).toEqual("inheritance_forbidden");
    expect(error.data).toEqual({ child: "Leaf", parent: "Grand" });
  });

  test("should register nothing for a class that fails the inheritance guard", () => {
    @Binding()
    class Base {}
    drainRegistrations();

    capture(() => {
      @Binding()
      class Leaf extends Base {}
      return Leaf;
    });

    expect(drainRegistrations()).toEqual([]);
  });

  test("a subclass should NOT mutate its parent's staged steps", () => {
    @Binding()
    class Parent {
      @Given("parent step")
      parent(): void {}
    }

    const [parentRegistration] = drainRegistrations();

    // The child's @Given runs BEFORE the class decorator throws, so naive
    // prototype-chain staging would already have polluted the parent here.
    capture(() => {
      @Binding()
      class Child extends Parent {
        @Given("child step")
        child(): void {}
      }
      return Child;
    });

    expect(parentRegistration.steps).toEqual([
      { decorator: "Given", expression: "parent step", methodName: "parent" },
    ]);
    expect(metadataOf(Parent)[STEPS_METADATA]).toEqual([
      { decorator: "Given", expression: "parent step", methodName: "parent" },
    ]);
  });
});
