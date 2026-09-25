import type { Feature, Step } from "@cucumber/messages";
import { isObject } from "@lindorm/is";
import { GherkinError } from "../../errors/GherkinError.js";
import { requireColumn } from "./require-column.js";

export type StepLocation = {
  column: number;
  line: number;
};

/**
 * Pickle steps carry no location — their line and column come from the AST
 * step behind `astNodeIds[0]`. Background steps (feature- AND rule-level) are
 * indexed too: compile() merges them into pickles, so their ids show up on
 * pickle steps.
 */
export const buildStepLocationIndex = (feature: Feature): Map<string, StepLocation> => {
  const index = new Map<string, StepLocation>();

  const add = (steps: ReadonlyArray<Step>): void => {
    for (const step of steps) {
      index.set(step.id, {
        column: requireColumn(step.location),
        line: step.location.line,
      });
    }
  };

  for (const child of feature.children) {
    if (isObject(child.background)) {
      add(child.background.steps);
    }
    if (isObject(child.scenario)) {
      add(child.scenario.steps);
    }
    if (isObject(child.rule)) {
      for (const ruleChild of child.rule.children) {
        if (isObject(ruleChild.background)) {
          add(ruleChild.background.steps);
        }
        if (isObject(ruleChild.scenario)) {
          add(ruleChild.scenario.steps);
        }
      }
    }
  }

  return index;
};

export const requireStepLocation = (
  index: Map<string, StepLocation>,
  id: string,
): StepLocation => {
  const location = index.get(id);

  if (isObject<StepLocation>(location)) {
    return location;
  }

  throw new GherkinError(`No AST step found for pickle step astNodeId "${id}"`, {
    code: "model_invariant",
    details:
      "Every pickle step's astNodeIds[0] must resolve to an AST step — a miss means the @cucumber/gherkin dependency changed behaviour underneath the model builder.",
    data: { id },
  });
};
