import { beforeEach, describe, expect, test } from "vitest";
import {
  capture,
  errorShape,
  metadataOf,
  RejectClass,
} from "../__fixtures__/test-helpers.js";
import { GherkinError } from "../errors/GherkinError.js";
import { STEPS_METADATA } from "../internal/metadata/symbols.js";
import {
  drainContextRegistrations,
  drainRegistrations,
} from "../internal/registry/registrations.js";
import { AbstractSteps } from "./AbstractSteps.js";
import { AfterScenario } from "./AfterScenario.js";
import { BeforeFeature } from "./BeforeFeature.js";
import { BeforeScenario } from "./BeforeScenario.js";
import { Binding } from "./Binding.js";
import { Context } from "./Context.js";
import { Given } from "./Given.js";
import { Inject } from "./Inject.js";
import { ParameterType } from "./ParameterType.js";
import { Priority } from "./Priority.js";

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
        hooks: [],
        injects: [],
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
      {
        className: "EmptySteps",
        hooks: [],
        injects: [],
        parameterTypes: [],
        steps: [],
        target: EmptySteps,
      },
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

  test("should register nothing when a LATER class decorator rejects the declaration", () => {
    capture(() => {
      @RejectClass()
      @Binding()
      class Rejected {
        @Given("a rejected step")
        rejectedStep(): void {}
      }
      return Rejected;
    });

    expect(drainRegistrations()).toEqual([]);
  });

  test("should register nothing when @Binding is applied twice", () => {
    capture(() => {
      @Binding()
      @Binding()
      class Twice {
        @Given("a step")
        step(): void {}
      }
      return Twice;
    });

    expect(drainRegistrations()).toEqual([]);
  });

  test("should register own hooks with the default priority 10 000 and the staged tag expression", () => {
    @Binding()
    class Hooks {
      @BeforeFeature("@docker")
      static start(): void {}

      @BeforeScenario()
      seed(): void {}

      @AfterScenario()
      dump(): void {}
    }

    const [registration] = drainRegistrations();

    expect(registration.className).toEqual("Hooks");
    expect(registration.hooks).toEqual([
      {
        kind: "BeforeFeature",
        methodName: "start",
        priority: 10_000,
        static: true,
        tagExpression: "@docker",
      },
      { kind: "BeforeScenario", methodName: "seed", priority: 10_000, static: false },
      { kind: "AfterScenario", methodName: "dump", priority: 10_000, static: false },
    ]);
  });

  test("should compose @Priority by the compound key — a static and an instance hook of the same name keep separate priorities", () => {
    @Binding()
    class Hooks {
      @BeforeFeature()
      @Priority(1)
      static setup(): void {}

      @BeforeScenario()
      @Priority(999)
      setup(): void {}
    }

    const [registration] = drainRegistrations();

    expect(registration.hooks).toEqual([
      { kind: "BeforeFeature", methodName: "setup", priority: 1, static: true },
      { kind: "BeforeScenario", methodName: "setup", priority: 999, static: false },
    ]);
  });

  test("should throw priority_without_hook for a @Priority on a step", () => {
    const error = capture(() => {
      @Binding()
      class Bad {
        @Given("a step")
        @Priority(5)
        step(): void {}
      }
      return Bad;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("priority_without_hook");
    expect(error.data).toEqual({ className: "Bad", method: "step", static: false });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should throw priority_without_hook for a @Priority on an undecorated method", () => {
    const error = capture(() => {
      @Binding()
      class Bad {
        @Priority(5)
        helper(): void {}
      }
      return Bad;
    });

    expect(error.code).toEqual("priority_without_hook");
    expect(error.data).toEqual({ className: "Bad", method: "helper", static: false });
  });

  test("should collect @Inject fields across an @AbstractSteps chain, nearest-wins on shadowing", () => {
    class BaseToken {}
    class LeafToken {}
    class SharedToken {}

    @AbstractSteps()
    abstract class Base {
      @Inject(BaseToken)
      shadowed!: BaseToken;

      @Inject(SharedToken)
      shared!: SharedToken;
    }

    @Binding()
    class Steps extends Base {
      // An initializer, not `!`: a decorated shadow field cannot be `declare`d
      // and TS2612 refuses a bare redeclaration under useDefineForClassFields.
      @Inject(LeafToken)
      shadowed: LeafToken = undefined!;
    }

    const [registration] = drainRegistrations();

    expect(registration.injects).toEqual([
      { fieldName: "shadowed", token: LeafToken },
      { fieldName: "shared", token: SharedToken },
    ]);
  });

  test("should name the UNMARKED class in a deep chain — not its already-decorated ancestor", () => {
    class GrandToken {}

    @AbstractSteps()
    abstract class Grand {
      @Inject(GrandToken)
      grand!: GrandToken;
    }

    class UnmarkedMid extends Grand {
      @Inject(GrandToken)
      mid!: GrandToken;
    }

    const error = capture(() => {
      @Binding()
      class Leaf extends UnmarkedMid {}
      return Leaf;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("abstract_base_undecorated");
    expect(error.data).toEqual({ ancestor: "UnmarkedMid", className: "Leaf" });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should throw abstract_base_declares_behaviour for a single undecorated base declaring a hook", () => {
    // The severity case: a dropped hook is invisible — it never runs and
    // nothing goes red — where a dropped step degrades to undefined_step.
    class UnmarkedBase {
      @BeforeScenario()
      seed(): void {}
    }

    const error = capture(() => {
      @Binding()
      class Leaf extends UnmarkedBase {}
      return Leaf;
    });

    expect(error.code).toEqual("abstract_base_declares_behaviour");
    expect(error.data).toEqual({
      ancestor: "UnmarkedBase",
      className: "Leaf",
      memberKind: "hook",
      memberName: "seed",
    });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should throw abstract_base_declares_behaviour for an undecorated base declaring a step", () => {
    class UnmarkedBase {
      @Given("a base step")
      baseStep(): void {}
    }

    const error = capture(() => {
      @Binding()
      class Leaf extends UnmarkedBase {}
      return Leaf;
    });

    expect(error.code).toEqual("abstract_base_declares_behaviour");
    expect(error.data).toEqual({
      ancestor: "UnmarkedBase",
      className: "Leaf",
      memberKind: "step",
      memberName: "baseStep",
    });
  });

  test("should throw abstract_base_undecorated for an @Inject-only undecorated base", () => {
    class Token {}

    class UnmarkedBase {
      @Inject(Token)
      token!: Token;
    }

    const error = capture(() => {
      @Binding()
      class Leaf extends UnmarkedBase {}
      return Leaf;
    });

    expect(error.code).toEqual("abstract_base_undecorated");
    expect(error.data).toEqual({ ancestor: "UnmarkedBase", className: "Leaf" });
  });

  test("should throw abstract_base_undecorated for a @Context-decorated base — the chain links but hooks would drop", () => {
    @Context()
    class TokenContext {}
    drainContextRegistrations();

    const error = capture(() => {
      @Binding()
      class Leaf extends TokenContext {}
      return Leaf;
    });

    expect(error.code).toEqual("abstract_base_undecorated");
    expect(error.data).toEqual({ ancestor: "TokenContext", className: "Leaf" });
  });

  test("should stay silent for an all-@AbstractSteps chain", () => {
    class Token {}

    @AbstractSteps()
    abstract class Grand {
      @Inject(Token)
      grand!: Token;
    }

    @AbstractSteps()
    abstract class Mid extends Grand {
      @Inject(Token)
      mid!: Token;
    }

    @Binding()
    class Leaf extends Mid {
      @Given("a leaf step")
      leafStep(): void {}
    }

    const [registration] = drainRegistrations();

    expect(registration.target).toBe(Leaf);
    expect(registration.steps.map((step) => step.expression)).toEqual(["a leaf step"]);
    expect(registration.injects).toEqual([
      { fieldName: "mid", token: Token },
      { fieldName: "grand", token: Token },
    ]);
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
