import { GherkinError } from "../../errors/GherkinError.js";
import { createParseError } from "../model/parse-error.js";
import type { FeatureModel, FeatureSuiteModel, SuiteNode } from "../model/types.js";
import type { GherkinRegistry } from "../registry/types.js";
import { createCountingSuiteApi } from "./counting-api.js";
import { formatEmptyExamples } from "./format/format-empty-examples.js";
import { formatEmptyScenario } from "./format/format-empty-scenario.js";
import { runScenario } from "./run-scenario.js";
import type { SuiteApi } from "./types.js";

const emitNode = (
  node: SuiteNode,
  api: SuiteApi,
  registry: GherkinRegistry,
  uri: string,
): void => {
  switch (node.kind) {
    case "rule":
      api.describe(node.name, () => {
        for (const child of node.children) {
          emitNode(child, api, registry, uri);
        }
      });
      return;

    case "scenario":
      api.test(node.name, () => runScenario({ registry, scenario: node, uri }));
      return;

    case "empty-examples":
      // An authoring error, never silent — the block compiled to zero
      // scenarios, so without this failing test it would contribute nothing
      // to the printed counts.
      api.test(node.name, () => {
        throw new GherkinError(formatEmptyExamples(node, uri), {
          code: "empty_examples",
          title: "Empty Examples Table",
          details:
            "The Examples table has a header and zero data rows, so the outline compiles to zero scenarios. Add data rows, or delete the block.",
          data: { line: node.line, name: node.name, uri },
        });
      });
      return;

    case "empty-scenario":
      // A zero-step scenario compiles to a zero-step pickle that would
      // iterate nothing and report green — the manufactured-green bug class.
      api.test(node.name, () => {
        throw new GherkinError(formatEmptyScenario(node, uri), {
          code: "empty_scenario",
          title: "Empty Scenario",
          details:
            "The scenario has a name and zero steps — running it would report green having executed nothing. Write its steps, or delete it.",
          data: { line: node.line, name: node.name, uri },
        });
      });
      return;

    default: {
      const exhaustive: never = node;
      throw new GherkinError("Unexpected suite node kind", {
        code: "model_invariant",
        title: "Model Invariant Violated",
        details: "The SuiteNode union gained a kind this emitter does not map.",
        data: { node: exhaustive },
      });
    }
  }
};

const emitFeatureSuite = (
  model: FeatureSuiteModel,
  api: SuiteApi,
  registry: GherkinRegistry,
): void => {
  const counting = createCountingSuiteApi(api);

  counting.api.describe(model.name, () => {
    for (const child of model.children) {
      emitNode(child, counting.api, registry, model.uri);
    }
  });

  // Registered LAST at top level: vitest collects suites depth-first in
  // registration order, so this factory runs AFTER the whole feature subtree
  // above has registered its tests (pinned: vitest-collect-behaviour.test.ts).
  // A skipped suite may be empty without dying, and a throw here is a loud
  // collection failure.
  api.describe.skip("gherkin structural invariant", () => {
    const registered = counting.registered();

    if (registered === model.expectedTests) {
      return;
    }

    throw new GherkinError(
      `Structural invariant violated: ${registered} tests registered, ${model.expectedTests} expected for ${model.uri}`,
      {
        code: "structural_invariant",
        title: "Structural Invariant Violated",
        details:
          "The number of registered tests must equal the model's expected count — a mismatch means the suite emitter dropped or doubled a scenario, a bug that would otherwise be invisible in the printed counts.",
        data: { expected: model.expectedTests, registered, uri: model.uri },
      },
    );
  });
};

export type EmitFeatureOptions = {
  api: SuiteApi;
  model: FeatureModel;
  registry: GherkinRegistry;
};

export const emitFeature = ({ api, model, registry }: EmitFeatureOptions): void => {
  switch (model.kind) {
    case "feature":
      emitFeatureSuite(model, api, registry);
      return;

    case "empty":
      // A file emitting no tests is a vitest collection error; an empty
      // SKIPPED suite makes the file report `skipped` instead. Pinned on the
      // real api: run-feature.vitest.test.ts.
      api.describe.skip(model.name ?? model.uri, () => {});
      return;

    case "parse-error":
      // ONE failing test carrying every parser error, anchored to the
      // feature file's lines via the model's entries.
      api.test("gherkin parse error", () => {
        throw createParseError(model);
      });
      return;

    default: {
      const exhaustive: never = model;
      throw new GherkinError("Unexpected feature model kind", {
        code: "model_invariant",
        title: "Model Invariant Violated",
        details: "The FeatureModel union gained a kind this emitter does not map.",
        data: { model: exhaustive },
      });
    }
  }
};
