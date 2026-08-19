import type { StepModel } from "../../model/types.js";
import type { StepDefinition } from "../../registry/types.js";
import { formatRemainingSteps } from "./format-remaining-steps.js";
import { formatStepAnchor } from "./format-step-anchor.js";
import { joinBlocks } from "./join-blocks.js";

export type AmbiguousStepFormat = {
  candidates: Array<StepDefinition>;
  remaining: number;
  step: StepModel;
  uri: string;
};

/**
 * Candidates render the decorator AS AUTHORED and the module path from the
 * registration association. No definition-side line:column — decorators
 * cannot know their source position, so M1 anchors a definition to its
 * module path alone.
 */
export const formatAmbiguousStep = ({
  candidates,
  remaining,
  step,
  uri,
}: AmbiguousStepFormat): string => {
  const labels = candidates.map(
    (candidate) => `${candidate.className}.${candidate.methodName}`,
  );
  const width = Math.max(...labels.map((label) => label.length));

  const lines = candidates.map(
    (candidate, index) =>
      `  ${labels[index].padEnd(width)}  @${candidate.decorator}(${JSON.stringify(candidate.expression)})\n` +
      `    at ${candidate.modulePath}`,
  );

  return joinBlocks([
    "Ambiguous step",
    formatStepAnchor(step, uri),
    `${candidates.length} step definitions matched:\n${lines.join("\n")}`,
    "Remove one, or make the expressions disjoint.",
    formatRemainingSteps(remaining),
  ]);
};
