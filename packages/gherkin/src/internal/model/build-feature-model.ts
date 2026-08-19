import {
  AstBuilder,
  GherkinClassicTokenMatcher,
  Parser,
  compile,
} from "@cucumber/gherkin";
import type { GherkinDocument } from "@cucumber/messages";
import { IdGenerator } from "@cucumber/messages";
import { isUndefined } from "@lindorm/is";
import { assertPickleParity } from "./assert-pickle-parity.js";
import type { ModelIndexes } from "./build-children.js";
import { buildChildren } from "./build-children.js";
import { countExpectedTests } from "./count-expected-tests.js";
import { toParseErrorEntries } from "./parse-error.js";
import { buildPickleIndex } from "./pickle-index.js";
import { buildStepLocationIndex } from "./step-location-index.js";
import type { FeatureModel } from "./types.js";

/**
 * Parses one feature file into pure JSON-serializable data — the transform
 * bakes the result into generated module source. A FRESH incrementing
 * IdGenerator per call (never uuid) keeps identical input producing identical
 * output for Vite's transform cache; the ids themselves never reach the model.
 *
 * Execution semantics come from compile()'s PICKLES (Background merging,
 * outline expansion, And/But type resolution); the AST supplies what pickles
 * cannot — nesting under Rules, feature-file line numbers via astNodeIds, and
 * zero-pickle authoring errors (zero-row Examples, zero-step scenarios).
 */
export const buildFeatureModel = (source: string, uri: string): FeatureModel => {
  const newId = IdGenerator.incrementing();
  const parser = new Parser(new AstBuilder(newId), new GherkinClassicTokenMatcher());

  let document: GherkinDocument;

  try {
    document = parser.parse(source);
  } catch (error) {
    return { errors: toParseErrorEntries(error), kind: "parse-error", uri };
  }

  if (isUndefined(document.feature)) {
    return { kind: "empty", name: null, uri };
  }

  const indexes: ModelIndexes = {
    consumedPickleKeys: new Set(),
    pickleIndex: buildPickleIndex(compile(document, uri, newId)),
    stepLocationIndex: buildStepLocationIndex(document.feature),
    supersededScenarioIds: new Set(),
  };

  const children = buildChildren(document.feature, indexes);

  assertPickleParity({
    consumedPickleKeys: indexes.consumedPickleKeys,
    pickleIndex: indexes.pickleIndex,
    supersededScenarioIds: indexes.supersededScenarioIds,
    uri,
  });

  if (children.length === 0) {
    return { kind: "empty", name: document.feature.name, uri };
  }

  return {
    children,
    expectedTests: countExpectedTests(children),
    kind: "feature",
    line: document.feature.location.line,
    name: document.feature.name,
    uri,
  };
};
