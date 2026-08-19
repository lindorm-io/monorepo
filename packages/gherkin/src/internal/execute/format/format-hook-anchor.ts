import type { ScenarioNode, StepModel } from "../../model/types.js";
import { formatAnchor } from "./format-anchor.js";
import { formatStepAnchor } from "./format-step-anchor.js";

/**
 * Feature hooks anchor to the feature FILE, not a line: the hook belongs to
 * the whole file (its tag expression evaluated the pickle-tag union), so no
 * single line in it is the failure site.
 */
export const formatFeatureHookAnchor = (
  className: string,
  methodName: string,
  uri: string,
): string => `  ${className}.${methodName}\n  at ${uri}`;

export const formatScenarioHookAnchor = (
  className: string,
  methodName: string,
  scenario: ScenarioNode,
  uri: string,
): string =>
  formatAnchor(`${className}.${methodName}`, uri, scenario.line, scenario.column);

/** The hook's identity above the step it bracketed. */
export const formatStepHookAnchor = (
  className: string,
  methodName: string,
  step: StepModel,
  uri: string,
): string => `  ${className}.${methodName}\n\n${formatStepAnchor(step, uri)}`;
