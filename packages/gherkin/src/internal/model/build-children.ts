import type { Feature, Pickle, PickleStep, Scenario } from "@cucumber/messages";
import { isObject, isUndefined } from "@lindorm/is";
import { pickleKey, requirePickle } from "./pickle-index.js";
import { requireColumn } from "./require-column.js";
import { requireTableHeader } from "./require-table-header.js";
import type { StepLocation } from "./step-location-index.js";
import { requireStepLocation } from "./step-location-index.js";
import { toStepType } from "./to-step-type.js";
import type { StepModel, SuiteNode } from "./types.js";

export type ModelIndexes = {
  /** Pickle keys the walk turned into scenario nodes — assert-pickle-parity.ts compares them against the full index. */
  consumedPickleKeys: Set<string>;
  pickleIndex: Map<string, Pickle>;
  stepLocationIndex: Map<string, StepLocation>;
  /** Scenario ids whose pickles were replaced by a failing `empty-scenario` node. */
  supersededScenarioIds: Set<string>;
};

const consumePickle = (
  indexes: ModelIndexes,
  astNodeIds: ReadonlyArray<string>,
): Pickle => {
  const key = pickleKey(astNodeIds);
  indexes.consumedPickleKeys.add(key);
  return requirePickle(indexes.pickleIndex, key);
};

const toStepModel = (step: PickleStep, indexes: ModelIndexes): StepModel => {
  const location = requireStepLocation(indexes.stepLocationIndex, step.astNodeIds[0]);

  return {
    column: location.column,
    hasArgument: isObject(step.argument),
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

const buildScenarioNodes = (
  scenario: Scenario,
  indexes: ModelIndexes,
  ruleName?: string,
): Array<SuiteNode> => {
  if (scenario.steps.length === 0) {
    // A Background does NOT rescue it: compile() skips background merging for
    // a zero-step scenario (compile.js compileScenario), so its pickle would
    // run zero steps and report green — the manufactured-green bug class. One
    // failing node per scenario, also when it is an outline whose rows would
    // each compile to a zero-step pickle. Those unconsumed pickles are
    // SUPERSEDED, not orphaned — recorded so assert-pickle-parity.ts stays
    // silent about them.
    indexes.supersededScenarioIds.add(scenario.id);
    return [
      {
        kind: "empty-scenario",
        column: requireColumn(scenario.location),
        line: scenario.location.line,
        name: scenario.name,
      },
    ];
  }

  if (scenario.examples.length === 0) {
    const pickle = consumePickle(indexes, [scenario.id]);
    return [
      toScenarioNode(
        pickle,
        scenario.location.line,
        requireColumn(scenario.location),
        indexes,
        { ruleName },
      ),
    ];
  }

  const nodes: Array<SuiteNode> = [];

  for (const examples of scenario.examples) {
    // compile() produces ZERO pickles for this block (header-less blocks are
    // filtered, zero-row bodies iterate nothing — compile.js
    // compileScenarioOutline), so without a failing node the block would
    // silently contribute zero tests.
    if (examples.tableBody.length === 0) {
      nodes.push({
        kind: "empty-examples",
        column: requireColumn(examples.location),
        line: examples.location.line,
        name: scenario.name,
      });
      continue;
    }

    const header = requireTableHeader(examples);

    for (const row of examples.tableBody) {
      const pickle = consumePickle(indexes, [scenario.id, row.id]);
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
          ruleName,
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

  for (const child of feature.children) {
    if (isObject(child.rule)) {
      const ruleChildren: Array<SuiteNode> = [];

      for (const ruleChild of child.rule.children) {
        if (isObject(ruleChild.scenario)) {
          ruleChildren.push(
            ...buildScenarioNodes(ruleChild.scenario, indexes, child.rule.name),
          );
        }
      }

      // An empty describe is a vitest collection error, so a Rule holding no
      // scenarios (nothing, or only a Background) emits no node at all.
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
      children.push(...buildScenarioNodes(child.scenario, indexes));
    }
  }

  return children;
};
