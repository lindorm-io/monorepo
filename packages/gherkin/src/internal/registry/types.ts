import type { ParameterTypeRegistry } from "@cucumber/cucumber-expressions";
import type { Constructor } from "@lindorm/types";
import type { StepDecoratorName } from "../metadata/staged.js";
import type { BindingRegistration } from "./registrations.js";

export type StepModule = {
  modulePath: string;
  registrations: Array<BindingRegistration>;
};

export type StepDefinition = {
  className: string;
  /** As authored — reporting only; matching is text-only. */
  decorator: StepDecoratorName;
  expression: string;
  methodName: string;
  modulePath: string;
  target: Constructor;
};

export type StepArgument = {
  parameterTypeName: string;
  /** The matched text before transformation — conversion failures report it. */
  raw: string;
  /**
   * Evaluates the argument's transform. May return a PromiseLike — the runner
   * awaits every argument BEFORE invoking the step, one at a time, so a
   * rejected transform surfaces as a conversion failure rather than as the
   * step's own failure.
   */
  value: () => unknown;
};

/**
 * Where a custom `@ParameterType` was declared — conversion failures anchor
 * to it. Built-in parameter types have no declaration site and no entry.
 */
export type ParameterTypeDeclaration = {
  className: string;
  methodName: string;
  modulePath: string;
};

export type AmbiguousMatch = {
  outcome: "ambiguous";
  candidates: Array<StepDefinition>;
};

export type ResolvedMatch = {
  outcome: "matched";
  definition: StepDefinition;
  args: Array<StepArgument>;
};

export type StepMatch = AmbiguousMatch | ResolvedMatch;

export type GherkinRegistry = {
  /** `undefined` = no definition matched (an undefined step). */
  match: (text: string) => StepMatch | undefined;
  /** Keyed by parameter type name; built-ins are absent. */
  parameterTypeDeclarations: Map<string, ParameterTypeDeclaration>;
  /** Snippet generation reads the same registry (CucumberExpressionGenerator). */
  parameterTypeRegistry: ParameterTypeRegistry;
};
