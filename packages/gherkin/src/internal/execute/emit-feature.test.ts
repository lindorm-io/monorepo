import { describe, expect, test } from "vitest";
import { createFakeSuiteApi } from "../../__fixtures__/suite-api.js";
import { capture, captureAsync, errorShape } from "../../__fixtures__/test-helpers.js";
import type {
  EmptyFeatureModel,
  FeatureModel,
  FeatureSuiteModel,
  SuiteNode,
} from "../model/types.js";
import { buildRegistry } from "../registry/build-registry.js";
import { emitFeature } from "./emit-feature.js";

const registry = buildRegistry([]);

const uri = "src/features/emit.feature";

const scenarioNode = (name: string): SuiteNode => ({
  kind: "scenario",
  column: 3,
  line: 3,
  name,
  steps: [
    {
      column: 5,
      hasArgument: false,
      line: 4,
      text: "an unmatched step",
      type: "Context",
    },
  ],
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
          [{ kind: "empty-examples", column: 5, line: 14, name: "hollow outline" }],
          1,
        ),
        registry,
      });

      const error = await captureAsync(() => fake.tests[0].body());

      expect(error.code).toBe("empty_examples");
      expect(error.message).toContain("at src/features/emit.feature:14:5");
      expect(errorShape(error)).toMatchSnapshot();
    });

    test("should emit a failing test for an empty-scenario node, anchored to the scenario line", async () => {
      const fake = createFakeSuiteApi();

      emitFeature({
        api: fake.api,
        model: featureModel(
          [{ kind: "empty-scenario", column: 3, line: 6, name: "nothing here" }],
          1,
        ),
        registry,
      });

      const error = await captureAsync(() => fake.tests[0].body());

      expect(error.code).toBe("empty_scenario");
      expect(error.message).toContain("at src/features/emit.feature:6:3");
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
