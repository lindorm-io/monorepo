import { isObject } from "@lindorm/is";
import type { StepModel } from "../../model/types.js";
import type { ParameterTypeDeclaration } from "../../registry/types.js";
import { formatRemainingSteps } from "./format-remaining-steps.js";
import { formatStepAnchor } from "./format-step-anchor.js";
import { joinBlocks } from "./join-blocks.js";

export type ConversionFailedFormat = {
  causeMessage: string;
  /** `undefined` for a built-in parameter type — no declaration site exists. */
  declaration: ParameterTypeDeclaration | undefined;
  parameterTypeName: string;
  raw: string;
  remaining: number;
  step: StepModel;
  uri: string;
};

export const formatConversionFailed = ({
  causeMessage,
  declaration,
  parameterTypeName,
  raw,
  remaining,
  step,
  uri,
}: ConversionFailedFormat): string => {
  const anchor = isObject(declaration)
    ? `\n  ${declaration.className}.${declaration.methodName} (${declaration.modulePath})`
    : "";

  return joinBlocks([
    "Step argument conversion failed",
    formatStepAnchor(step, uri),
    `Parameter {${parameterTypeName}} could not convert ${JSON.stringify(raw)}${anchor}\n  ${causeMessage}`,
    "The step matched — the argument did not convert.",
    formatRemainingSteps(remaining),
  ]);
};
