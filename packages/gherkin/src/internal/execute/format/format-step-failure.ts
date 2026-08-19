import type { StepModel } from "../../model/types.js";
import { formatRemainingSteps } from "./format-remaining-steps.js";
import { formatStepAnchor } from "./format-step-anchor.js";
import { joinBlocks } from "./join-blocks.js";

export type StepFailureFormat = {
  /** The original error's message — preserved verbatim, never re-worded. */
  message: string;
  remaining: number;
  step: StepModel;
  uri: string;
};

export const formatStepFailure = ({
  message,
  remaining,
  step,
  uri,
}: StepFailureFormat): string =>
  joinBlocks([
    "Step failed",
    formatStepAnchor(step, uri),
    message,
    formatRemainingSteps(remaining),
  ]);
