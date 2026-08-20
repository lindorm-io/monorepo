import type { Feature, Pickle, PickleStep, Scenario } from "@cucumber/messages";
import { isNull, isObject, isUndefined } from "@lindorm/is";
import type { TagMatcher } from "../registry/compile-tag-expression.js";
import { pickleKey, requirePickle } from "./pickle-index.js";
import { requireColumn } from "./require-column.js";
import { requireTableHeader } from "./require-table-header.js";
import type { StepLocation } from "./step-location-index.js";
import { requireStepLocation } from "./step-location-index.js";
import { toStepArgumentModel } from "./to-step-argument-model.js";
import { toStepType } from "./to-step-type.js";
import type { StepModel, SuiteNode } from "./types.js";

export type ModelIndexes = {
  /** Pickle keys the walk turned into scenario nodes — assert-pickle-parity.ts compares them against the full index. */
  consumedPickleKeys: Set<string>;
  /** Pickle keys the settings `tags` expression excluded — never suite nodes, accounted by assert-pickle-parity.ts. */
  excludedPickleKeys: Set<string>;
  pickleIndex: Map<string, Pickle>;
  stepLocationIndex: Map<string, StepLocation>;
  /** Scenario ids whose pickles were replaced by a failing `empty-scenario` node. */
  supersededScenarioIds: Set<string>;
  /**
   * Transform-time selection (resolve-settings.ts `tags`) — evaluated per
   * PICKLE over its inherited @-prefixed tag set, the same set hook tag
   * expressions evaluate against.
   */
  tagFilter: TagMatcher;
};

/**
 * Retained pickles are CONSUMED (they become scenario nodes); excluded ones
 * are recorded and never become tests — omitted at transform time, unlike
 * --tagsFilter's runtime skip (README.md#tags names the two filters).
 */
const selectPickle = (
  indexes: ModelIndexes,
  astNodeIds: ReadonlyArray<string>,
): Pickle | null => {
  const key = pickleKey(astNodeIds);
  const pickle = requirePickle(indexes.pickleIndex, key);

  if (indexes.tagFilter(pickle.tags.map((tag) => tag.name))) {
    indexes.consumedPickleKeys.add(key);
    return pickle;
  }

  indexes.excludedPickleKeys.add(key);
  return null;
};

const toStepModel = (step: PickleStep, indexes: ModelIndexes): StepModel => {
  const location = requireStepLocation(indexes.stepLocationIndex, step.astNodeIds[0]);

  return {
    // Conditional spread, never `key: undefined` — the transform
    // JSON.stringifies the model into module source, and an absent key must
    // stay absent so identical input keeps emitting byte-identical source.
    ...(isObject(step.argument) ? { argument: toStepArgumentModel(step.argument) } : {}),
    column: location.column,
    line: location.line,
    text: step.text,
    type: toStepType(step.type),
  };
};

type ScenarioNodeExtras = {
  /** `[header, value]` pairs in column order — outline rows only. */
  examplesRow?: Array<[string, string]>;
  ruleName?: string;
};

const toScenarioNode = (
  pickle: Pickle,
  line: number,
  column: number,
  indexes: ModelIndexes,
  extras: ScenarioNodeExtras,
): SuiteNode => ({
  kind: "scenario",
  column,
  // Conditional spread, never `key: undefined`: the transform JSON.stringifies
  // the model into module source, and an absent key must stay absent so
  // identical input keeps emitting byte-identical source.
  ...(isUndefined(extras.examplesRow) ? {} : { examplesRow: extras.examplesRow }),
  line,
  name: pickle.name,
  ...(isUndefined(extras.ruleName) ? {} : { ruleName: extras.ruleName }),
  steps: pickle.steps.map((step) => toStepModel(step, indexes)),
  // The PICKLE's tags, never the AST scenario's — compile() concatenates
  // feature -> rule -> scenario -> examples tags onto each pickle
  // (compile.js compileScenario/compileScenarioOutline), and only that full
  // set is what hook tag expressions evaluate against.
  tags: pickle.tags.map((tag) => tag.name),
});

/** What a scenario node inherits from the AST levels ABOVE it. */
type InheritedContext = {
  ruleName?: string;
  /** Feature (+ rule) tag names, `@` kept — for nodes without a pickle to inherit from. */
  tags: Array<string>;
};

const buildScenarioNodes = (
  scenario: Scenario,
  indexes: ModelIndexes,
  inherited: InheritedContext,
): Array<SuiteNode> => {
  if (scenario.steps.length === 0) {
    // A Background does NOT rescue it: compile() skips background merging for
    // a zero-step scenario (compile.js compileScenario), so its pickle would
    // run zero steps and report green — the manufactured-green bug class. One
    // failing node per scenario, also when it is an outline whose rows would
    // each compile to a zero-step pickle. Those unconsumed pickles are
    // SUPERSEDED, not orphaned — recorded so assert-pickle-parity.ts stays
    // silent about them. Emitted BEFORE the tags filter is consulted: an
    // authoring error a `tags` expression could exclude would be a skip tag
    // by the back door — tag it, exclude the tag, and the red disappears
    // (pinned: build-feature-model.test.ts "should keep an empty scenario
    // RED when the tags expression excludes its tags").
    indexes.supersededScenarioIds.add(scenario.id);
    return [
      {
        kind: "empty-scenario",
        column: requireColumn(scenario.location),
        line: scenario.location.line,
        name: scenario.name,
        // Examples-level tags included: ONE node stands in for a zero-step
        // outline's every row, so dropping them would leave the red carrying
        // fewer tags than the rows it replaces — invisible under a
        // --tagsFilter for its own lane (to-vitest-tags.ts dedupes).
        tags: [
          ...inherited.tags,
          ...scenario.tags.map((tag) => tag.name),
          ...scenario.examples.flatMap((examples) =>
            examples.tags.map((tag) => tag.name),
          ),
        ],
      },
    ];
  }

  if (scenario.examples.length === 0) {
    const pickle = selectPickle(indexes, [scenario.id]);

    if (isNull(pickle)) {
      return [];
    }

    return [
      toScenarioNode(
        pickle,
        scenario.location.line,
        requireColumn(scenario.location),
        indexes,
        { ruleName: inherited.ruleName },
      ),
    ];
  }

  const nodes: Array<SuiteNode> = [];

  for (const examples of scenario.examples) {
    // compile() produces ZERO pickles for this block (header-less blocks are
    // filtered, zero-row bodies iterate nothing — compile.js
    // compileScenarioOutline), so without a failing node the block would
    // silently contribute zero tests. Checked BEFORE any per-pickle tag
    // evaluation — there is no pickle to evaluate — which is exactly what
    // keeps it separable from the quiet all-rows-excluded case below: the
    // two are indistinguishable from pickles alone.
    if (examples.tableBody.length === 0) {
      nodes.push({
        kind: "empty-examples",
        column: requireColumn(examples.location),
        line: examples.location.line,
        name: scenario.name,
        tags: [
          ...inherited.tags,
          ...scenario.tags.map((tag) => tag.name),
          ...examples.tags.map((tag) => tag.name),
        ],
      });
      continue;
    }

    const header = requireTableHeader(examples);

    for (const row of examples.tableBody) {
      // Per-ROW selection (the row's pickle carries the Examples block's
      // tags): a block whose every row is excluded contributes nothing — a
      // legitimate exclusion, never an error, unlike the zero-row block
      // above (pinned: build-feature-model.test.ts, meta-tags.test.ts).
      const pickle = selectPickle(indexes, [scenario.id, row.id]);

      if (isNull(pickle)) {
        continue;
      }

      // Header/value pairing by cell index — the same pairing compile() uses
      // for `<placeholder>` interpolation, and the parser rejects a ragged
      // table, so every row carries exactly one cell per header column.
      const examplesRow: Array<[string, string]> = header.cells.map((cell, index) => [
        cell.value,
        row.cells[index].value,
      ]);

      nodes.push(
        toScenarioNode(pickle, row.location.line, requireColumn(row.location), indexes, {
          examplesRow,
          ruleName: inherited.ruleName,
        }),
      );
    }
  }

  return nodes;
};

/**
 * Children preserve source order. The grammar itself puts feature-level
 * scenarios before the first Rule (Feature := FeatureHeader Background?
 * ScenarioDefinition* Rule*) — a scenario written after a Rule belongs to it.
 */
export const buildChildren = (
  feature: Feature,
  indexes: ModelIndexes,
): Array<SuiteNode> => {
  const children: Array<SuiteNode> = [];
  const featureTags = feature.tags.map((tag) => tag.name);

  for (const child of feature.children) {
    if (isObject(child.rule)) {
      const ruleChildren: Array<SuiteNode> = [];
      const ruleTags = [...featureTags, ...child.rule.tags.map((tag) => tag.name)];

      for (const ruleChild of child.rule.children) {
        if (isObject(ruleChild.scenario)) {
          ruleChildren.push(
            ...buildScenarioNodes(ruleChild.scenario, indexes, {
              ruleName: child.rule.name,
              tags: ruleTags,
            }),
          );
        }
      }

      // An empty describe is a vitest collection error, so a Rule holding no
      // scenarios (nothing, only a Background, or everything excluded by the
      // tags expression) emits no node at all.
      if (ruleChildren.length > 0) {
        children.push({
          children: ruleChildren,
          kind: "rule",
          line: child.rule.location.line,
          name: child.rule.name,
        });
      }
      continue;
    }

    if (isObject(child.scenario)) {
      children.push(
        ...buildScenarioNodes(child.scenario, indexes, { tags: featureTags }),
      );
    }
  }

  return children;
};
