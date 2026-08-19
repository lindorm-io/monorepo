import { beforeEach, describe, expect, test } from "vitest";
import { capture, errorShape } from "../__fixtures__/test-helpers.js";
import { GherkinError } from "../errors/GherkinError.js";
import { CONTEXT_BRAND } from "../internal/metadata/symbols.js";
import {
  drainContextRegistrations,
  drainRegistrations,
} from "../internal/registry/registrations.js";
import { AbstractSteps } from "./AbstractSteps.js";
import { BeforeScenario } from "./BeforeScenario.js";
import { Binding } from "./Binding.js";
import { Context } from "./Context.js";
import { Given } from "./Given.js";
import { Inject } from "./Inject.js";
import { ParameterType } from "./ParameterType.js";
import { Priority } from "./Priority.js";

class OtherContext {}

describe("Context", () => {
  beforeEach(() => {
    drainRegistrations();
    drainContextRegistrations();
  });

  test("should register the class as a token with its @Inject fields and brand it", () => {
    @Context()
    class AesContext {
      @Inject(OtherContext)
      other!: OtherContext;

      value?: string;
    }

    expect(drainContextRegistrations()).toEqual([
      {
        className: "AesContext",
        injects: [{ fieldName: "other", token: OtherContext }],
        target: AesContext,
      },
    ]);
    expect(Object.hasOwn(AesContext, CONTEXT_BRAND)).toEqual(true);
    // A context never registers as a binding.
    expect(drainRegistrations()).toEqual([]);
  });

  test("should collect inherited @Inject fields from an @AbstractSteps base, nearest-wins", () => {
    class BaseToken {}
    class LeafToken {}

    @AbstractSteps()
    abstract class Base {
      @Inject(BaseToken)
      shadowed!: BaseToken;

      @Inject(OtherContext)
      other!: OtherContext;
    }

    @Context()
    class LeafContext extends Base {
      @Inject(LeafToken)
      shadowed: LeafToken = undefined!;
    }

    expect(drainContextRegistrations()).toEqual([
      {
        className: "LeafContext",
        injects: [
          { fieldName: "shadowed", token: LeafToken },
          { fieldName: "other", token: OtherContext },
        ],
        target: LeafContext,
      },
    ]);
  });

  test("should throw duplicate_context when @Context is applied twice", () => {
    const error = capture(() => {
      @Context()
      @Context()
      class Twice {}
      return Twice;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("duplicate_context");
    expect(error.data).toEqual({ className: "Twice" });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should throw inheritance_forbidden when a @Context class extends a @Context class", () => {
    @Context()
    class Base {}
    drainContextRegistrations();

    const error = capture(() => {
      @Context()
      class Leaf extends Base {}
      return Leaf;
    });

    expect(error.code).toEqual("inheritance_forbidden");
    expect(error.data).toEqual({ child: "Leaf", parent: "Base" });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should throw inheritance_forbidden when a @Context class extends a @Binding class", () => {
    @Binding()
    class Base {}
    drainRegistrations();

    const error = capture(() => {
      @Context()
      class Leaf extends Base {}
      return Leaf;
    });

    expect(error.code).toEqual("inheritance_forbidden");
    expect(error.data).toEqual({ child: "Leaf", parent: "Base" });
  });

  test("should throw abstract_base_undecorated for an unmarked base carrying decorated members", () => {
    class UnmarkedBase {
      @Inject(OtherContext)
      other!: OtherContext;
    }

    const error = capture(() => {
      @Context()
      class Leaf extends UnmarkedBase {}
      return Leaf;
    });

    expect(error.code).toEqual("abstract_base_undecorated");
    expect(error.data).toEqual({ ancestor: "UnmarkedBase", className: "Leaf" });
  });

  test("should throw context_declares_behaviour for a staged step, naming the member", () => {
    const error = capture(() => {
      @Context()
      class Bad {
        @Given("a context step")
        contextStep(): void {}
      }
      return Bad;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("context_declares_behaviour");
    expect(error.data).toEqual({
      className: "Bad",
      memberKind: "step",
      memberName: "contextStep",
    });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should throw context_declares_behaviour for a staged hook, naming the member", () => {
    // The severity case: a hook on a context is never collected, so it would
    // silently never run.
    const error = capture(() => {
      @Context()
      class Bad {
        @BeforeScenario()
        seed(): void {}
      }
      return Bad;
    });

    expect(error.code).toEqual("context_declares_behaviour");
    expect(error.data).toEqual({
      className: "Bad",
      memberKind: "hook",
      memberName: "seed",
    });
  });

  test("should throw context_declares_behaviour for a staged parameter type, naming the member", () => {
    const error = capture(() => {
      @Context()
      class Bad {
        @ParameterType("algorithm", /[A-Za-z0-9-]+/)
        static algorithm(raw: string): string {
          return raw;
        }
      }
      return Bad;
    });

    expect(error.code).toEqual("context_declares_behaviour");
    expect(error.data).toEqual({
      className: "Bad",
      memberKind: "parameter type",
      memberName: "algorithm",
    });
  });

  test("should throw priority_without_hook for a @Priority on a context method", () => {
    const error = capture(() => {
      @Context()
      class Bad {
        @Priority(5)
        dispose(): void {}
      }
      return Bad;
    });

    expect(error.code).toEqual("priority_without_hook");
    expect(error.data).toEqual({ className: "Bad", method: "dispose", static: false });
  });

  test("should register nothing for a class that fails a guard", () => {
    @Context()
    class Base {}
    drainContextRegistrations();

    capture(() => {
      @Context()
      class Leaf extends Base {}
      return Leaf;
    });

    expect(drainContextRegistrations()).toEqual([]);
  });

  test("should allow extending a plain undecorated helper base", () => {
    class Helper {
      helper(): string {
        return "helper";
      }
    }

    @Context()
    class LeafContext extends Helper {}

    expect(drainContextRegistrations().map((entry) => entry.className)).toEqual([
      "LeafContext",
    ]);
    expect(new LeafContext().helper()).toEqual("helper");
  });
});
