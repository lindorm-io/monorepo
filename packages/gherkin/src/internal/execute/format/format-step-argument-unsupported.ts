import type { StepModel } from "../../model/types.js";
import { formatRemainingSteps } from "./format-remaining-steps.js";
import { formatStepAnchor } from "./format-step-anchor.js";
import { joinBlocks } from "./join-blocks.js";

export type StepArgumentUnsupportedFormat = {
  remaining: number;
  step: StepModel;
  uri: string;
};

export const formatStepArgumentUnsupported = ({
  remaining,
  step,
  uri,
}: StepArgumentUnsupportedFormat): string =>
  joinBlocks([
    "Step argument not supported",
    formatStepAnchor(step, uri),
    "The step carries a DocString or DataTable, which this milestone cannot deliver — DataTable and DocString support lands in a later milestone. Running the step without its argument would silently drop the author's data, so it fails instead.",
    formatRemainingSteps(remaining),
  ]);
