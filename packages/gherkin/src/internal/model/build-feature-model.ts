import {
  AstBuilder,
  GherkinClassicTokenMatcher,
  Parser,
  compile,
} from "@cucumber/gherkin";
import type { GherkinDocument } from "@cucumber/messages";
import { IdGenerator } from "@cucumber/messages";
import { isUndefined } from "@lindorm/is";
import type { TagMatcher } from "../registry/compile-tag-expression.js";
import { assertPickleParity } from "./assert-pickle-parity.js";
import { assertSupportedTags } from "./assert-supported-tags.js";
import { assertTagNames } from "./assert-tag-names.js";
import { collectAstTags } from "./collect-ast-tags.js";
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
 *
 * `tagFilter` is the settings `tags` expression (resolve-settings.ts) —
 * default retains everything. An excluded scenario is omitted HERE, at
 * transform time: it never becomes a test, unlike --tagsFilter's runtime
 * skip (README.md#tags).
 */
export const buildFeatureModel = (
  source: string,
  uri: string,
  tagFilter: TagMatcher = () => true,
): FeatureModel => {
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

  // Before compile and before selection: a bad tag fails the transform even
  // on a node the tags expression would exclude — never silently inert. The
  // name check also runs in the config-time scan (scan-tag-declarations.ts),
  // which is what anchors the common case; this is the backstop for a file
  // the scan's `features` filter did not cover.
  const astTags = collectAstTags(document.feature);

  assertSupportedTags(astTags, uri);
  assertTagNames(astTags, uri);

  const indexes: ModelIndexes = {
    consumedPickleKeys: new Set(),
    excludedPickleKeys: new Set(),
    pickleIndex: buildPickleIndex(compile(document, uri, newId)),
    stepLocationIndex: buildStepLocationIndex(document.feature),
    supersededScenarioIds: new Set(),
    tagFilter,
  };

  const children = buildChildren(document.feature, indexes);

  assertPickleParity({
    consumedPickleKeys: indexes.consumedPickleKeys,
    excludedPickleKeys: indexes.excludedPickleKeys,
    pickleIndex: indexes.pickleIndex,
    supersededScenarioIds: indexes.supersededScenarioIds,
    uri,
  });

  // Zero children also when the tags expression excluded EVERY scenario —
  // the "empty" kind's skipped suite is the fallback for both.
  if (children.length === 0) {
    return { kind: "empty", name: document.feature.name, uri };
  }

  // Union over the RETAINED pickles (the Map preserves compile order), never
  // the AST feature tags alone — a tag authored at scenario or Examples level
  // reaches the feature set only through its pickle. Superseded zero-step
  // scenarios contribute too: their pickles exist and their tests run (RED).
  // Excluded pickles do NOT: their scenarios do not exist, so a feature hook
  // gated on their tags must not fire.
  const tags = [
    ...new Set(
      [...indexes.pickleIndex.entries()]
        .filter(([key]) => indexes.excludedPickleKeys.has(key) === false)
        .flatMap(([, pickle]) => pickle.tags.map((tag) => tag.name)),
    ),
  ];

  return {
    children,
    expectedTests: countExpectedTests(children),
    kind: "feature",
    line: document.feature.location.line,
    name: document.feature.name,
    tags,
    uri,
  };
};
