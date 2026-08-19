import { formatRemainingSteps } from "./format-remaining-steps.js";
import { joinBlocks } from "./join-blocks.js";

export type ConstructorFailureFormat = {
  /**
   * Prebuilt position block: the failing step's anchor for the lazy
   * step-matched path, or the scenario's anchor for the eager hook-class
   * construction path — which has no step, every hook-declaring class being
   * constructed before the first step runs (run-scenario.ts).
   */
  anchor: string;
  className: string;
  /** The original error's message — preserved verbatim, never re-worded. */
  message: string;
  remaining: number;
};

export const formatConstructorFailure = ({
  anchor,
  className,
  message,
  remaining,
}: ConstructorFailureFormat): string =>
  joinBlocks([
    `Binding class ${className} constructor threw`,
    anchor,
    message,
    formatRemainingSteps(remaining),
  ]);
