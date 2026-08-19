import type { ParameterTypeRegistry } from "@cucumber/cucumber-expressions";
import type { Constructor } from "@lindorm/types";
import type {
  ComposedHook,
  HookKind,
  StagedInject,
  StepDecoratorName,
} from "../metadata/staged.js";
import type { TagMatcher } from "./compile-tag-expression.js";
import type { BindingRegistration, ContextRegistration } from "./registrations.js";

export type StepModule = {
  modulePath: string;
  registrations: Array<BindingRegistration>;
};

export type StepDefinition = {
  className: string;
  /** As authored — reporting only; matching is text-only. */
  decorator: StepDecoratorName;
  expression: string;
  /**
   * The declaring class's `@Inject` fields, carried so the runner can assign
   * them right after constructing the binding instance — a map lookup would
   * add an unreachable miss branch, since every matched definition IS a
   * registered binding.
   */
  injects: Array<StagedInject>;
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

/** The method itself is reached via `target` + `methodName` + `static`. */
export type RegistryHook = ComposedHook & {
  className: string;
  /** As on StepDefinition — the declaring class's `@Inject` fields. */
  injects: Array<StagedInject>;
  /**
   * The compiled tag expression (compile-tag-expression.ts). Scenario- and
   * step-level hooks evaluate the SCENARIO's tags; feature hooks evaluate the
   * feature's pickle-tag union (FeatureSuiteModel.tags). Absent expression ⇒
   * always true.
   */
  matches: TagMatcher;
  modulePath: string;
  target: Constructor;
};

/**
 * Every kind in the TOTAL order — priority ascending, module path ascending,
 * declaration order within the file. After* kinds are served ascending too:
 * ONE invariant across all six kinds instead of a per-kind special case, and
 * the reversal (teardown unwinds setup) is execution semantics, applied at
 * the consumers — run-scenario.ts (the After-scenario/step loops) and
 * feature-hooks.ts (the afterAll walk). The catalogue records what exists,
 * the runner decides traversal.
 */
export type RegistryHooks = Record<HookKind, Array<RegistryHook>>;

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
  /**
   * Every `@Context` registration drained after the step modules loaded — the
   * per-scenario container is created from these (run-scenario.ts).
   */
  contexts: Array<ContextRegistration>;
  hooks: RegistryHooks;
  /** `undefined` = no definition matched (an undefined step). */
  match: (text: string) => StepMatch | undefined;
  /** Keyed by parameter type name; built-ins are absent. */
  parameterTypeDeclarations: Map<string, ParameterTypeDeclaration>;
  /** Snippet generation reads the same registry (CucumberExpressionGenerator). */
  parameterTypeRegistry: ParameterTypeRegistry;
};
