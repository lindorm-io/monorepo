import type { StepModel } from "../../model/types.js";
import { formatRemainingSteps } from "./format-remaining-steps.js";
import { formatStepAnchor } from "./format-step-anchor.js";
import { indent } from "./indent.js";
import { joinBlocks } from "./join-blocks.js";

export type UndefinedStepFormat = {
  remaining: number;
  snippet: string;
  step: StepModel;
  uri: string;
};

export const formatUndefinedStep = ({
  remaining,
  snippet,
  step,
  uri,
}: UndefinedStepFormat): string =>
  joinBlocks([
    "Undefined step",
    formatStepAnchor(step, uri),
    "No step definition matched. Implement it:",
    indent(snippet, 2),
    formatRemainingSteps(remaining),
  ]);
