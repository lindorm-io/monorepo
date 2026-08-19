import type { Constructor } from "@lindorm/types";
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

export type HookKind =
  | "BeforeFeature"
  | "AfterFeature"
  | "BeforeScenario"
  | "AfterScenario"
  | "BeforeStep"
  | "AfterStep";

export type StagedHook = {
  kind: HookKind;
  methodName: string;
  static: boolean;
  /** Stored verbatim — parsed and validated when hook execution evaluates it. */
  tagExpression?: string;
};

/** A hook with its `@Priority` resolved — what registration records. */
export type ComposedHook = StagedHook & { priority: number };

export type StagedInject = {
  fieldName: string;
  token: Constructor;
};

export type StagedPriority = {
  /**
   * `${static}:${methodName}` — static and instance decorators share ONE
   * metadata bag, so a class carrying a static and an instance hook with the
   * SAME name would collide under a bare methodName key and a lookup would
   * hand both hooks one priority. Pinned: Priority.test.ts.
   */
  key: string;
  methodName: string;
  priority: number;
  static: boolean;
};

export type StagedParameterType = {
  methodName: string;
  name: string;
  options: ParameterTypeOptions;
  regexp: RegExp | Array<RegExp>;
  transform: StepFn;
};
