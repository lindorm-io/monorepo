import type { ParameterTypeOptions } from "../../types/parameter-type-options.js";
import type { StepFn } from "../../types/step-fn.js";

export type StepDecoratorName = "Given" | "When" | "Then";

export type StagedStep = {
  /**
   * The decorator the author wrote. Matching is text-only (the keyword is
   * decorative), so this exists for reporting alone — an ambiguous-step
   * message must point at the declaration as authored, or it misdirects the
   * fix.
   */
  decorator: StepDecoratorName;
  expression: string;
  methodName: string;
};

export type StagedParameterType = {
  methodName: string;
  name: string;
  options: ParameterTypeOptions;
  regexp: RegExp | Array<RegExp>;
  transform: StepFn;
};
