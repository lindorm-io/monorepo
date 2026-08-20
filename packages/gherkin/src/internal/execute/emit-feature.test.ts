import { describe, expect, test } from "vitest";
import { createFakeSuiteApi } from "../../__fixtures__/suite-api.js";
import { capture, captureAsync, errorShape } from "../../__fixtures__/test-helpers.js";
import { AfterFeature } from "../../decorators/AfterFeature.js";
import { BeforeFeature } from "../../decorators/BeforeFeature.js";
import { Binding } from "../../decorators/Binding.js";
import type {
  EmptyFeatureModel,
  FeatureModel,
  FeatureSuiteModel,
  SuiteNode,
} from "../model/types.js";
import { buildRegistry } from "../registry/build-registry.js";
import { drainRegistrations } from "../registry/registrations.js";
import { emitFeature } from "./emit-feature.js";

const registry = buildRegistry([]);

const uri = "src/features/emit.feature";

const scenarioNode = (name: string, tags: Array<string> = []): SuiteNode => ({
  kind: "scenario",
  column: 3,
  line: 3,
  name,
  steps: [
    {
      column: 5,
      line: 4,
      text: "an unmatched step",
      type: "Context",
    },
  ],
  tags,
});

const featureModel = (
  children: Array<SuiteNode>,
  expectedTests: number,
): FeatureSuiteModel => ({
  children,
  expectedTests,
  kind: "feature",
  line: 1,
  name: "emit feature",
  tags: [],
  uri,
});

describe("emitFeature", () => {
  describe("feature models", () => {
    test("should nest scenarios under the feature and Rules under nested describes", () => {
      const fake = createFakeSuiteApi();

      emitFeature({
        api: fake.api,
        model: featureModel(
          [
            scenarioNode("top level"),
            {
              children: [scenarioNode("inside the rule")],
              kind: "rule",
              line: 6,
              name: "a rule",
            },
          ],
          2,
        ),
        registry,
      });

      expect(fake.suites).toEqual([
        { mode: "normal", name: "emit feature", path: [] },
        { mode: "normal", name: "a rule", path: ["emit feature"] },
        {
          mode: "skip",
          name: "gherkin structural invariant",
          path: [],
        },
      ]);
      expect(fake.tests.map((entry) => ({ name: entry.name, path: entry.path }))).toEqual(
        [
          { name: "top level", path: ["emit feature"] },
          { name: "inside the rule", path: ["emit feature", "a rule"] },
        ],
      );
    });

    test("should wire scenario test bodies to runScenario", async () => {
      const fake = createFakeSuiteApi();

      emitFeature({
        api: fake.api,
        model: featureModel([scenarioNode("runs the runner")], 1),
        registry,
      });

      const error = await captureAsync(() => fake.tests[0].body());

      expect(error.code).toBe("undefined_step");
    });

    test("should emit a failing test for an empty-examples node, anchored to the Examples line", async () => {
      const fake = createFakeSuiteApi();

      emitFeature({
        api: fake.api,
        model: featureModel(
          [
            {
              kind: "empty-examples",
              column: 5,
              line: 14,
              name: "hollow outline",
              tags: ["@lane", "@slow"],
            },
          ],
          1,
        ),
        registry,
      });

      const error = await captureAsync(() => fake.tests[0].body());

      expect(error.code).toBe("empty_examples");
      expect(error.message).toContain("at src/features/emit.feature:14:5");
      // Registered WITH its inherited tags, stripped — a tagless red would be
      // skipped by EVERY positive --tagsFilter (probe-measured), hiding the
      // authoring error from the very lane it belongs to.
      expect(fake.tests[0].tags).toEqual(["lane", "slow"]);
      expect(errorShape(error)).toMatchSnapshot();
    });

    test("should emit a failing test for an empty-scenario node, anchored to the scenario line", async () => {
      const fake = createFakeSuiteApi();

      emitFeature({
        api: fake.api,
        model: featureModel(
          [
            {
              kind: "empty-scenario",
              column: 3,
              line: 6,
              name: "nothing here",
              tags: ["@lane"],
            },
          ],
          1,
        ),
        registry,
      });

      const error = await captureAsync(() => fake.tests[0].body());

      expect(error.code).toBe("empty_scenario");
      expect(error.message).toContain("at src/features/emit.feature:6:3");
      expect(fake.tests[0].tags).toEqual(["lane"]);
      expect(errorShape(error)).toMatchSnapshot();
    });

    test("should throw on a suite node kind outside the union", () => {
      const fake = createFakeSuiteApi();

      const error = capture(() =>
        emitFeature({
          api: fake.api,
          model: featureModel([{ kind: "bogus" } as never], 1),
          registry,
        }),
      );

      expect(error.code).toBe("model_invariant");
    });
  });

  describe("vitest tag threading", () => {
    test("should register a scenario's tags stripped of @ and deduplicated", () => {
      const fake = createFakeSuiteApi();

      emitFeature({
        api: fake.api,
        model: featureModel(
          // A tag inherited from feature AND scenario level arrives twice on
          // the pickle — one vitest tag must come out.
          [scenarioNode("tagged", ["@lane", "@smoke", "@lane"])],
          1,
        ),
        registry,
      });

      expect(fake.tests[0].tags).toEqual(["lane", "smoke"]);
    });

    test("should register a parse-error test with NO tags — an unparseable file yields none", () => {
      const fake = createFakeSuiteApi();

      emitFeature({
        api: fake.api,
        model: {
          errors: [{ message: "expected: #EOF" }],
          kind: "parse-error",
          uri,
        },
        registry,
      });

      expect(fake.tests[0].tags).toEqual([]);
    });
  });

  describe("structural invariant", () => {
    test("should stay silent when registrations equal the expected count", () => {
      const fake = createFakeSuiteApi();

      emitFeature({
        api: fake.api,
        model: featureModel([scenarioNode("counted")], 1),
        registry,
      });

      expect(fake.suites.at(-1)).toEqual({
        mode: "skip",
        name: "gherkin structural invariant",
        path: [],
      });
    });

    test("should throw stating both numbers and the uri on a mismatch", () => {
      const fake = createFakeSuiteApi();

      // A model whose expectedTests lies about its tree — the emitter
      // registers 1 test, the model claims 3.
      const error = capture(() =>
        emitFeature({
          api: fake.api,
          model: featureModel([scenarioNode("only one")], 3),
          registry,
        }),
      );

      expect(error.code).toBe("structural_invariant");
      expect(error.message).toBe(
        "Structural invariant violated: 1 tests registered, 3 expected for src/features/emit.feature",
      );
      expect(error.data).toEqual({ expected: 3, registered: 1, uri });
      expect(errorShape(error)).toMatchSnapshot();
    });
  });

  describe("empty models", () => {
    test("should emit an empty skipped suite named after the feature", () => {
      const fake = createFakeSuiteApi();
      const model: EmptyFeatureModel = { kind: "empty", name: "background only", uri };

      emitFeature({ api: fake.api, model, registry });

      expect(fake.suites).toEqual([{ mode: "skip", name: "background only", path: [] }]);
      expect(fake.tests).toEqual([]);
    });

    test("should fall back to the uri when the file had no feature at all", () => {
      const fake = createFakeSuiteApi();
      const model: EmptyFeatureModel = { kind: "empty", name: null, uri };

      emitFeature({ api: fake.api, model, registry });

      expect(fake.suites).toEqual([{ mode: "skip", name: uri, path: [] }]);
    });
  });

  describe("parse-error models", () => {
    test("should emit ONE failing test carrying the anchored parser errors", async () => {
      const fake = createFakeSuiteApi();

      emitFeature({
        api: fake.api,
        model: {
          errors: [{ column: 3, line: 4, message: "expected: #EOF, got 'rogue line'" }],
          kind: "parse-error",
          uri,
        },
        registry,
      });

      expect(fake.tests.map((entry) => entry.name)).toEqual(["gherkin parse error"]);

      const error = await captureAsync(() => fake.tests[0].body());

      expect(error.code).toBe("parse_error");
      expect(error.message).toContain("expected: #EOF, got 'rogue line'");
      expect(error.message).toContain("at src/features/emit.feature:4:3");
      expect(error.data).toEqual({
        errors: [{ column: 3, line: 4, message: "expected: #EOF, got 'rogue line'" }],
        uri,
      });
      expect(errorShape(error)).toMatchSnapshot();
    });
  });

  describe("feature hooks", () => {
    test("should register matching feature hooks INSIDE the feature suite, before its children", async () => {
      @Binding()
      class FeatureLifecycle {
        static ran: Array<string> = [];

        @BeforeFeature()
        static start(): void {
          FeatureLifecycle.ran.push("start");
        }

        @AfterFeature("@docker")
        static stopDocker(): void {
          FeatureLifecycle.ran.push("stopDocker");
        }

        @AfterFeature("@never")
        static neverRuns(): void {
          FeatureLifecycle.ran.push("neverRuns");
        }
      }

      const hooked = buildRegistry([
        { modulePath: "src/hooked.steps.ts", registrations: drainRegistrations() },
      ]);
      const fake = createFakeSuiteApi();
      const model = { ...featureModel([scenarioNode("only")], 1), tags: ["@docker"] };

      emitFeature({ api: fake.api, model, registry: hooked });

      // beforeAll and the matching afterAll registered inside "emit feature";
      // the "@never" hook registered NOTHING.
      expect(fake.lifecycles.map(({ kind, path }) => ({ kind, path }))).toEqual([
        { kind: "beforeAll", path: ["emit feature"] },
        { kind: "afterAll", path: ["emit feature"] },
      ]);

      await fake.lifecycles[0].fn();
      await fake.lifecycles[1].fn();

      expect(FeatureLifecycle.ran).toEqual(["start", "stopDocker"]);
    });

    test("should keep the structural invariant green — lifecycle registrations are not tests", () => {
      @Binding()
      class InvariantLifecycle {
        @BeforeFeature()
        static start(): void {}
      }

      const hooked = buildRegistry([
        { modulePath: "src/invariant.steps.ts", registrations: drainRegistrations() },
      ]);
      const fake = createFakeSuiteApi();

      emitFeature({
        api: fake.api,
        model: featureModel([scenarioNode("only")], 1),
        registry: hooked,
      });

      // The trailing skipped suite's factory IS the invariant check — a
      // counted beforeAll would make it throw here.
      expect(fake.suites.at(-1)).toEqual({
        mode: "skip",
        name: "gherkin structural invariant",
        path: [],
      });
    });
  });

  describe("model kinds", () => {
    test("should throw on a model kind outside the union", () => {
      const fake = createFakeSuiteApi();

      const error = capture(() =>
        emitFeature({
          api: fake.api,
          model: { kind: "bogus" } as unknown as FeatureModel,
          registry,
        }),
      );

      expect(error.code).toBe("model_invariant");
    });
  });
});
