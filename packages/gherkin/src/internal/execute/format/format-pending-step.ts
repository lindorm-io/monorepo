import type { StepModel } from "../../model/types.js";
import { formatRemainingSteps } from "./format-remaining-steps.js";
import { formatStepAnchor } from "./format-step-anchor.js";
import { joinBlocks } from "./join-blocks.js";

export type PendingStepFormat = {
  className: string;
  methodName: string;
  remaining: number;
  step: StepModel;
  uri: string;
};

export const formatPendingStep = ({
  className,
  methodName,
  remaining,
  step,
  uri,
}: PendingStepFormat): string =>
  joinBlocks([
    "Pending step",
    formatStepAnchor(step, uri),
    `${className}.${methodName} is pending — implement its body.`,
    formatRemainingSteps(remaining),
  ]);
