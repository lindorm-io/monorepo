/**
 * The skipped-count line a step failure carries. Zero remaining steps returns
 * an empty string — the line is omitted entirely, matching the failure
 * contract's examples which show it only when steps remain.
 */
export const formatRemainingSteps = (remaining: number): string => {
  if (remaining === 0) {
    return "";
  }

  if (remaining === 1) {
    return "The remaining 1 step in this scenario was skipped.";
  }

  return `The remaining ${remaining} steps in this scenario were skipped.`;
};
