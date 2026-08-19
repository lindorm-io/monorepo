import type { StepModel } from "../../model/types.js";
import { formatAnchor } from "./format-anchor.js";
import { toDisplayKeyword } from "./to-display-keyword.js";

export const formatStepAnchor = (step: StepModel, uri: string): string =>
  formatAnchor(
    `${toDisplayKeyword(step.type)} ${step.text}`,
    uri,
    step.line,
    step.column,
  );
