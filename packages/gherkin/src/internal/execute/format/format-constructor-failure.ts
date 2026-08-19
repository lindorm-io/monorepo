import type { StepModel } from "../../model/types.js";
import { formatRemainingSteps } from "./format-remaining-steps.js";
import { formatStepAnchor } from "./format-step-anchor.js";
import { joinBlocks } from "./join-blocks.js";

export type ConstructorFailureFormat = {
  className: string;
  /** The original error's message — preserved verbatim, never re-worded. */
  message: string;
  remaining: number;
  step: StepModel;
  uri: string;
};

export const formatConstructorFailure = ({
  className,
  message,
  remaining,
  step,
  uri,
}: ConstructorFailureFormat): string =>
  joinBlocks([
    `Binding class ${className} constructor threw`,
    formatStepAnchor(step, uri),
    message,
    formatRemainingSteps(remaining),
  ]);
