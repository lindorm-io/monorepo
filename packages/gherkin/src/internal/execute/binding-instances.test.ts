import { describe, expect, test } from "vitest";
import { ScenarioInfo } from "../../classes/ScenarioInfo.js";
import { capture } from "../../__fixtures__/test-helpers.js";
import { createScenarioContainer } from "../container/create-scenario-container.js";
import type { ScenarioContainer } from "../container/types.js";
import type { ContextRegistration } from "../registry/registrations.js";
import { createBindingInstances } from "./binding-instances.js";

const scenarioInfo = new ScenarioInfo({
  featureName: "binding instances",
  featureUri: "src/features/binding.feature",
  line: 3,
  scenarioName: "under test",
  tags: [],
});

const container = (contexts: Array<ContextRegistration> = []): ScenarioContainer =>
  createScenarioContainer({ contexts, scenarioInfo });

const position = {
  anchor: "  under test\n  at src/features/binding.feature:3:3",
  remaining: 2,
};

describe("createBindingInstances", () => {
  test("should construct once and serve the SAME instance on every later acquire", () => {
    class Steps {
      static constructed = 0;

      constructor() {
        Steps.constructed += 1;
      }
    }

    const instances = createBindingInstances(container());
    const binding = { className: "Steps", injects: [], target: Steps };

    const first = instances.acquire(binding, position);
    const second = instances.acquire(binding, position);

    expect(first).toBe(second);
    expect(Steps.constructed).toBe(1);
  });

  test("should assign @Inject fields through the container immediately after construction", () => {
    class SharedContext {}

    class Steps {
      shared!: SharedContext;
      info!: ScenarioInfo;
    }

    const scoped = container([
      { className: "SharedContext", injects: [], target: SharedContext },
    ]);
    const instances = createBindingInstances(scoped);

    const instance = instances.acquire(
      {
        className: "Steps",
        injects: [
          { fieldName: "shared", token: SharedContext },
          { fieldName: "info", token: ScenarioInfo },
        ],
        target: Steps,
      },
      position,
    ) as Steps;

    expect(instance.shared).toBeInstanceOf(SharedContext);
    expect(instance.info).toBe(scenarioInfo);
    // The container's singleton — a second class injecting the same token
    // shares the very instance.
    expect(scoped.resolve(SharedContext)).toBe(instance.shared);
  });

  test("should return undefined from get for a class never acquired", () => {
    class Steps {}

    const instances = createBindingInstances(container());

    expect(instances.get(Steps)).toBeUndefined();

    instances.acquire({ className: "Steps", injects: [], target: Steps }, position);

    expect(instances.get(Steps)).toBeInstanceOf(Steps);
  });

  test("should anchor a throwing constructor to the class with the given position", () => {
    class ThrowingSteps {
      constructor() {
        throw new Error("no store configured");
      }
    }

    const instances = createBindingInstances(container());

    const error = capture(() =>
      instances.acquire(
        { className: "ThrowingSteps", injects: [], target: ThrowingSteps },
        position,
      ),
    );

    expect(error.message).toMatchSnapshot();
  });

  test("should wrap a non-Error constructor throw into an Error with the original as cause", () => {
    class StringThrowingSteps {
      constructor() {
        // eslint-disable-next-line no-throw-literal
        throw "ctor string";
      }
    }

    const instances = createBindingInstances(container());

    const error = capture(() =>
      instances.acquire(
        { className: "StringThrowingSteps", injects: [], target: StringThrowingSteps },
        position,
      ),
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain(
      "Binding class StringThrowingSteps constructor threw",
    );
    expect(error.message).toContain("ctor string");
    expect((error as unknown as { cause: unknown }).cause).toBe("ctor string");
  });

  test("should anchor a FROZEN binding-constructor error, retaining it as cause", () => {
    const original = Object.freeze(new Error("frozen store boom"));

    class FrozenSteps {
      constructor() {
        throw original;
      }
    }

    const instances = createBindingInstances(container());

    const error = capture(() =>
      instances.acquire(
        { className: "FrozenSteps", injects: [], target: FrozenSteps },
        position,
      ),
    );

    expect(error.message).toBe(
      [
        "Binding class FrozenSteps constructor threw",
        "",
        "  under test",
        "  at src/features/binding.feature:3:3",
        "",
        "frozen store boom",
        "",
        "The remaining 2 steps in this scenario were skipped.",
      ].join("\n"),
    );
    expect(error.cause).toBe(original);
  });

  test("should anchor the SAME thrown instance twice independently, never compounding its message", () => {
    const original = new Error("shared store boom");

    class SharedThrowSteps {
      constructor() {
        throw original;
      }
    }

    const binding = {
      className: "SharedThrowSteps",
      injects: [],
      target: SharedThrowSteps,
    };
    const instances = createBindingInstances(container());

    const first = capture(() => instances.acquire(binding, position));
    const second = capture(() => instances.acquire(binding, position));

    expect(first).not.toBe(second);
    expect(first.message).toContain("Binding class SharedThrowSteps constructor threw");
    expect(first.message).toContain("shared store boom");
    expect(second.message).toBe(first.message);
    expect(original.message).toBe("shared store boom");
  });

  test("should let a context constructor failure propagate with its TOKEN anchor untouched", () => {
    class BrokenContext {
      constructor() {
        throw new Error("context boom");
      }
    }

    class Steps {
      broken!: BrokenContext;
    }

    const instances = createBindingInstances(
      container([{ className: "BrokenContext", injects: [], target: BrokenContext }]),
    );

    const error = capture(() =>
      instances.acquire(
        {
          className: "Steps",
          injects: [{ fieldName: "broken", token: BrokenContext }],
          target: Steps,
        },
        position,
      ),
    );

    // Anchored by the container to the TOKEN, not re-wrapped as a binding
    // constructor failure (create-scenario-container.ts).
    expect(error.message).toBe(
      "Context class BrokenContext constructor threw\n\ncontext boom",
    );
  });
});
