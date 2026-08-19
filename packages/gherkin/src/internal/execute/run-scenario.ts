import { isError, isObjectLike, isUndefined } from "@lindorm/is";
import type { Constructor } from "@lindorm/types";
import { GherkinError } from "../../errors/GherkinError.js";
import { isPendingStepError } from "../../errors/is-pending-step-error.js";
import type { StepFn } from "../../types/step-fn.js";
import type { ScenarioNode, StepModel } from "../model/types.js";
import type { GherkinRegistry, ResolvedMatch } from "../registry/types.js";
import { formatAmbiguousStep } from "./format/format-ambiguous-step.js";
import { formatConstructorFailure } from "./format/format-constructor-failure.js";
import { formatConversionFailed } from "./format/format-conversion-failed.js";
import { formatPendingStep } from "./format/format-pending-step.js";
import { formatStepArgumentUnsupported } from "./format/format-step-argument-unsupported.js";
import { formatStepFailure } from "./format/format-step-failure.js";
import { formatUndefinedStep } from "./format/format-undefined-step.js";
import { generateSnippet } from "./format/generate-snippet.js";

export type RunScenarioOptions = {
  registry: GherkinRegistry;
  scenario: ScenarioNode;
  uri: string;
};

type StepContext = {
  registry: GherkinRegistry;
  /** Steps after this one — they are never executed once this one fails. */
  remaining: number;
  step: StepModel;
  uri: string;
};

/**
 * Arguments are awaited one at a time, ALL before the step is invoked — so a
 * rejected transform surfaces as `conversion_failed`, never as the step's own
 * failure, even when the step body would also throw. Pinned:
 * run-scenario.test.ts ("reports conversion_failed for a rejected async
 * transform even when the step body would throw").
 */
const convertArguments = async (
  match: ResolvedMatch,
  { registry, remaining, step, uri }: StepContext,
): Promise<Array<unknown>> => {
  const converted: Array<unknown> = [];

  for (const argument of match.args) {
    try {
      converted.push(await argument.value());
    } catch (error) {
      throw new GherkinError(
        formatConversionFailed({
          causeMessage: isError(error) ? error.message : String(error),
          declaration: registry.parameterTypeDeclarations.get(argument.parameterTypeName),
          parameterTypeName: argument.parameterTypeName,
          raw: argument.raw,
          remaining,
          step,
          uri,
        }),
        {
          code: "conversion_failed",
          title: "Step Argument Conversion Failed",
          details:
            "The step matched a definition, but a parameter type's transform threw or rejected while converting the matched text. Fix the value in the feature file, or the transform.",
          data: {
            line: step.line,
            parameterTypeName: argument.parameterTypeName,
            raw: argument.raw,
            text: step.text,
            uri,
          },
          ...(isError(error) ? { error } : {}),
        },
      );
    }
  }

  return converted;
};

/**
 * One instance per binding class per SCENARIO, constructed lazily on the
 * first step that matches into the class — never shared across scenarios
 * (the cache lives in the scenario body).
 */
const resolveInstance = (
  instances: Map<Constructor, object>,
  match: ResolvedMatch,
  { remaining, step, uri }: StepContext,
): object => {
  const existing = instances.get(match.definition.target);

  // isObjectLike, not isObject: a binding instance's prototype is its class,
  // which isObject rejects — and a missed cache hit here would silently hand
  // every step a fresh instance. Pinned: run-scenario.test.ts ("should run
  // steps sequentially against ONE instance per class").
  if (isObjectLike(existing)) {
    return existing;
  }

  try {
    const instance = new match.definition.target() as object;
    instances.set(match.definition.target, instance);
    return instance;
  } catch (error) {
    // The original error is rethrown with its message extended in place —
    // wrapping in a new error would drop the stack and any assertion diff.
    if (isError(error)) {
      error.message = formatConstructorFailure({
        className: match.definition.className,
        message: error.message,
        remaining,
        step,
        uri,
      });
      throw error;
    }

    throw new Error(
      formatConstructorFailure({
        className: match.definition.className,
        message: String(error),
        remaining,
        step,
        uri,
      }),
      { cause: error },
    );
  }
};

const invokeStep = async (
  instance: object,
  match: ResolvedMatch,
  converted: Array<unknown>,
  { remaining, step, uri }: StepContext,
): Promise<void> => {
  try {
    // AWAITED: a step returning a rejecting promise must fail the scenario
    // here, not surface as an unhandled-rejection side note attributed to
    // whichever test happens to be running.
    await (instance as Record<string, StepFn>)[match.definition.methodName](...converted);
  } catch (error) {
    // Brand-based, never instanceof — a PendingStepError thrown by a second
    // installed copy of this package must still report as pending.
    if (isPendingStepError(error)) {
      throw new GherkinError(
        formatPendingStep({
          className: match.definition.className,
          methodName: match.definition.methodName,
          remaining,
          step,
          uri,
        }),
        {
          code: "pending_step",
          title: "Pending Step",
          details:
            "The step matched a definition whose body is not implemented; the scenario is red until it is.",
          data: {
            className: match.definition.className,
            line: step.line,
            methodName: match.definition.methodName,
            text: step.text,
            uri,
          },
          error,
        },
      );
    }

    // The ORIGINAL error is rethrown with its message extended in place:
    // rethrowing the same instance keeps the stack and the assertion
    // actual/expected pair, so vitest still prints an expect() diff. Pinned:
    // run-scenario.test.ts ("preserves the original error instance").
    if (isError(error)) {
      error.message = formatStepFailure({
        message: error.message,
        remaining,
        step,
        uri,
      });
      throw error;
    }

    throw new Error(formatStepFailure({ message: String(error), remaining, step, uri }), {
      cause: error,
    });
  }
};

/**
 * The body of one scenario test. Steps run SEQUENTIALLY; the first failure
 * throws, so the remaining steps are never executed (skipped, not failed) and
 * the failure message carries their count.
 */
export const runScenario = async ({
  registry,
  scenario,
  uri,
}: RunScenarioOptions): Promise<void> => {
  const instances = new Map<Constructor, object>();

  for (const [index, step] of scenario.steps.entries()) {
    const context: StepContext = {
      registry,
      remaining: scenario.steps.length - index - 1,
      step,
      uri,
    };

    // BEFORE matching: no registry content can make a DocString/DataTable
    // step deliverable in this milestone, so the guard is unconditional.
    if (step.hasArgument) {
      throw new GherkinError(formatStepArgumentUnsupported(context), {
        code: "step_argument_unsupported",
        title: "Step Argument Not Supported",
        details:
          "The step carries a DocString or DataTable; delivering them lands in a later milestone. Running the step without its argument would silently drop data, so it fails instead.",
        data: { line: step.line, text: step.text, uri },
      });
    }

    const match = registry.match(step.text);

    if (isUndefined(match)) {
      throw new GherkinError(
        formatUndefinedStep({
          remaining: context.remaining,
          snippet: generateSnippet(step, registry.parameterTypeRegistry),
          step,
          uri,
        }),
        {
          code: "undefined_step",
          title: "Undefined Step",
          details:
            "No step definition matched the step text. Paste the snippet into a @Binding class and implement it.",
          data: { line: step.line, text: step.text, uri },
        },
      );
    }

    if (match.outcome === "ambiguous") {
      throw new GherkinError(
        formatAmbiguousStep({
          candidates: match.candidates,
          remaining: context.remaining,
          step,
          uri,
        }),
        {
          code: "ambiguous_step",
          title: "Ambiguous Step",
          details:
            "More than one step definition matched the step text. Matching is text-only — the decorator keyword does not disambiguate. Remove one, or make the expressions disjoint.",
          data: {
            candidates: match.candidates.map(
              ({ className, expression, methodName, modulePath }) => ({
                className,
                expression,
                methodName,
                modulePath,
              }),
            ),
            line: step.line,
            text: step.text,
            uri,
          },
        },
      );
    }

    const converted = await convertArguments(match, context);
    const instance = resolveInstance(instances, match, context);

    await invokeStep(instance, match, converted, context);
  }
};
