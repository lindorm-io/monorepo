import type { Constructor } from "@lindorm/types";
import { describe, expect, test } from "vitest";
import { createFakeSuiteApi } from "../../__fixtures__/suite-api.js";
import { captureAsync } from "../../__fixtures__/test-helpers.js";
import type { HookKind } from "../metadata/staged.js";
import type { FeatureSuiteModel } from "../model/types.js";
import type { GherkinRegistry, RegistryHook } from "../registry/types.js";
import { registerFeatureHooks } from "./feature-hooks.js";

const model = (tags: Array<string> = []): FeatureSuiteModel => ({
  children: [],
  expectedTests: 0,
  kind: "feature",
  line: 1,
  name: "feature hooks",
  tags,
  uri: "src/features/hooks.feature",
});

type HookSpec = {
  kind: HookKind;
  methodName: string;
  tagExpression?: string;
  target: Constructor;
};

const hook = ({ kind, methodName, tagExpression, target }: HookSpec): RegistryHook => ({
  className: target.name,
  injects: [],
  kind,
  matches: (tags) => tagExpression === undefined || tags.includes(tagExpression),
  methodName,
  modulePath: "src/hooks.steps.ts",
  priority: 10_000,
  static: true,
  target,
  ...(tagExpression === undefined ? {} : { tagExpression }),
});

const registry = (hooks: Array<RegistryHook>): GherkinRegistry =>
  ({
    contexts: [],
    hooks: {
      AfterFeature: hooks.filter((entry) => entry.kind === "AfterFeature"),
      AfterScenario: [],
      AfterStep: [],
      BeforeFeature: hooks.filter((entry) => entry.kind === "BeforeFeature"),
      BeforeScenario: [],
      BeforeStep: [],
    },
  }) as unknown as GherkinRegistry;

describe("registerFeatureHooks", () => {
  test("should register NOTHING when no feature hook exists", () => {
    const fake = createFakeSuiteApi();

    registerFeatureHooks({ api: fake.api, model: model(), registry: registry([]) });

    expect(fake.lifecycles).toEqual([]);
  });

  test("should register NOTHING for hooks whose tag expression does not match the feature union", () => {
    const fake = createFakeSuiteApi();

    class DockerHooks {
      static start(): void {}
      static stop(): void {}
    }

    registerFeatureHooks({
      api: fake.api,
      model: model(["@unit"]),
      registry: registry([
        hook({
          kind: "BeforeFeature",
          methodName: "start",
          tagExpression: "@docker",
          target: DockerHooks,
        }),
        hook({
          kind: "AfterFeature",
          methodName: "stop",
          tagExpression: "@docker",
          target: DockerHooks,
        }),
      ]),
    });

    expect(fake.lifecycles).toEqual([]);
  });

  test("should run before-feature hooks sequentially in ascending order inside ONE beforeAll", async () => {
    const fake = createFakeSuiteApi();
    const order: Array<string> = [];

    class AlphaHooks {
      static async first(): Promise<void> {
        await Promise.resolve();
        order.push("first");
      }
      static second(): void {
        order.push("second");
      }
    }

    registerFeatureHooks({
      api: fake.api,
      model: model(["@docker"]),
      registry: registry([
        hook({ kind: "BeforeFeature", methodName: "first", target: AlphaHooks }),
        hook({
          kind: "BeforeFeature",
          methodName: "second",
          tagExpression: "@docker",
          target: AlphaHooks,
        }),
      ]),
    });

    expect(fake.lifecycles.map((entry) => entry.kind)).toEqual(["beforeAll"]);

    await fake.lifecycles[0].fn();

    // The async first hook FINISHED before the sync second started — awaited
    // sequentially, never Promise.all.
    expect(order).toEqual(["first", "second"]);
  });

  test("should stop the remaining before-feature hooks at the first throw, anchored to class.method and uri", async () => {
    const fake = createFakeSuiteApi();
    const order: Array<string> = [];

    class BrokenHooks {
      static boom(): void {
        throw new Error("no docker daemon");
      }
      static never(): void {
        order.push("never");
      }
    }

    registerFeatureHooks({
      api: fake.api,
      model: model(),
      registry: registry([
        hook({ kind: "BeforeFeature", methodName: "boom", target: BrokenHooks }),
        hook({ kind: "BeforeFeature", methodName: "never", target: BrokenHooks }),
      ]),
    });

    const error = await captureAsync(() => fake.lifecycles[0].fn());

    expect(error.message).toMatchSnapshot();
    expect(order).toEqual([]);
  });

  test("should run after-feature hooks REVERSED and register no beforeAll for them", async () => {
    const fake = createFakeSuiteApi();
    const order: Array<string> = [];

    class TeardownHooks {
      static first(): void {
        order.push("first");
      }
      static second(): void {
        order.push("second");
      }
    }

    registerFeatureHooks({
      api: fake.api,
      model: model(),
      registry: registry([
        hook({ kind: "AfterFeature", methodName: "first", target: TeardownHooks }),
        hook({ kind: "AfterFeature", methodName: "second", target: TeardownHooks }),
      ]),
    });

    expect(fake.lifecycles.map((entry) => entry.kind)).toEqual(["afterAll"]);

    await fake.lifecycles[0].fn();

    // The registry serves ascending [first, second]; teardown unwinds setup.
    expect(order).toEqual(["second", "first"]);
  });

  test("should run EVERY after-feature hook despite a throw and compose the failures primary-first", async () => {
    const fake = createFakeSuiteApi();
    const order: Array<string> = [];

    class LeakyTeardown {
      static early(): void {
        order.push("early");
      }
      static failing(): void {
        throw new Error("port still bound");
      }
      static alsoFailing(): void {
        throw new Error("volume still mounted");
      }
    }

    registerFeatureHooks({
      api: fake.api,
      model: model(),
      registry: registry([
        hook({ kind: "AfterFeature", methodName: "early", target: LeakyTeardown }),
        hook({ kind: "AfterFeature", methodName: "failing", target: LeakyTeardown }),
        hook({ kind: "AfterFeature", methodName: "alsoFailing", target: LeakyTeardown }),
      ]),
    });

    const error = await captureAsync(() => fake.lifecycles[0].fn());

    // Reversed execution [alsoFailing, failing, early]: BOTH throws collected,
    // the first-encountered is primary, and `early` still ran.
    expect(order).toEqual(["early"]);
    expect(error.message).toMatchSnapshot();
  });

  test("should pass when every after-feature hook passes", async () => {
    const fake = createFakeSuiteApi();

    class CleanTeardown {
      static stop(): void {}
    }

    registerFeatureHooks({
      api: fake.api,
      model: model(),
      registry: registry([
        hook({ kind: "AfterFeature", methodName: "stop", target: CleanTeardown }),
      ]),
    });

    await expect(fake.lifecycles[0].fn()).resolves.toBeUndefined();
  });

  test("should invoke static hooks on the CLASS — `this` is the declaring class", async () => {
    const fake = createFakeSuiteApi();
    const receivers: Array<unknown> = [];

    class SelfAware {
      static start(this: unknown): void {
        receivers.push(this);
      }
    }

    registerFeatureHooks({
      api: fake.api,
      model: model(),
      registry: registry([
        hook({ kind: "BeforeFeature", methodName: "start", target: SelfAware }),
      ]),
    });

    await fake.lifecycles[0].fn();

    expect(receivers).toEqual([SelfAware]);
  });
});
