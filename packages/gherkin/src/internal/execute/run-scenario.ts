import { isError, isUndefined } from "@lindorm/is";
import { ScenarioInfo } from "../../classes/ScenarioInfo.js";
import { GherkinError } from "../../errors/GherkinError.js";
import { isPendingStepError } from "../../errors/is-pending-step-error.js";
import type { ScenarioResult } from "../../types/scenario-result.js";
import type { StepFn } from "../../types/step-fn.js";
import type { StepInfo } from "../../types/step-info.js";
import type { StepResult } from "../../types/step-result.js";
import { createScenarioContainer } from "../container/create-scenario-container.js";
import type { ScenarioNode, StepModel } from "../model/types.js";
import type { GherkinRegistry, RegistryHook, ResolvedMatch } from "../registry/types.js";
import { createBindingInstances } from "./binding-instances.js";
import { composeFailures } from "./compose-failures.js";
import { formatAnchor } from "./format/format-anchor.js";
import { formatConversionFailed } from "./format/format-conversion-failed.js";
import {
  formatScenarioHookAnchor,
  formatStepHookAnchor,
} from "./format/format-hook-anchor.js";
import { formatHookFailure } from "./format/format-hook-failure.js";
import { formatPendingStep } from "./format/format-pending-step.js";
import { formatStepAnchor } from "./format/format-step-anchor.js";
import { formatStepFailure } from "./format/format-step-failure.js";
import { invokeHook } from "./invoke-hook.js";
import { resolveDispatch } from "./resolve-dispatch.js";
import { toStepArgument } from "./to-step-argument.js";

export type RunScenarioOptions = {
  featureName: string;
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
          details:
            "The step matched a definition, but a parameter type's transform threw or rejected while converting the matched text. Fix the value in the feature file, or the transform.",
          data: {
            line: step.line,
            parameterTypeName: argument.parameterTypeName,
            raw: argument.raw,
            text: step.text,
            uri,
          },
          cause: error,
        },
      );
    }
  }

  return converted;
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
    //
    // The TRAILING slot is passed UNCONDITIONALLY — DataTable, DocString or
    // undefined — so the argument position never shifts with its presence
    // (§3.6: filtering an absent slot out moves every parameter, the
    // @amiceli arity bug). Pinned: run-scenario.test.ts ("stable arity").
    await (instance as Record<string, StepFn>)[match.definition.methodName](
      ...converted,
      toStepArgument(step.argument),
    );
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
          details:
            "The step matched a definition whose body is not implemented; the scenario is red until it is.",
          data: {
            className: match.definition.className,
            line: step.line,
            methodName: match.definition.methodName,
            text: step.text,
            uri,
          },
          cause: error,
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
 * The body of one scenario test — the full lifecycle: eager hook-class
 * construction → `@BeforeScenario` → steps (each bracketed by step hooks) →
 * `@AfterScenario` → container disposal. The after-phases and disposal ALWAYS
 * run; every failure is collected and the FIRST is thrown with the rest
 * appended to its message, never replacing it (§4; compose-failures.ts).
 */
export const runScenario = async ({
  featureName,
  registry,
  scenario,
  uri,
}: RunScenarioOptions): Promise<void> => {
  const scenarioInfo = new ScenarioInfo({
    featureName,
    featureUri: uri,
    line: scenario.line,
    scenarioName: scenario.name,
    tags: scenario.tags,
    ...(isUndefined(scenario.examplesRow) ? {} : { examplesRow: scenario.examplesRow }),
    ...(isUndefined(scenario.ruleName) ? {} : { ruleName: scenario.ruleName }),
  });

  const container = createScenarioContainer({
    contexts: registry.contexts,
    scenarioInfo,
  });
  const instances = createBindingInstances(container);

  /** In lifecycle order — index 0 is the PRIMARY failure the scenario throws. */
  const failures: Array<Error> = [];

  const matched = {
    afterScenario: registry.hooks.AfterScenario.filter((hook) =>
      hook.matches(scenario.tags),
    ),
    afterStep: registry.hooks.AfterStep.filter((hook) => hook.matches(scenario.tags)),
    beforeScenario: registry.hooks.BeforeScenario.filter((hook) =>
      hook.matches(scenario.tags),
    ),
    beforeStep: registry.hooks.BeforeStep.filter((hook) => hook.matches(scenario.tags)),
  };

  const scenarioAnchor = formatAnchor(scenario.name, uri, scenario.line, scenario.column);

  const stepHookFormat =
    (hook: RegistryHook, step: StepModel, remaining: number) =>
    (message: string): string =>
      formatHookFailure({
        anchor: formatStepHookAnchor(hook.className, hook.methodName, step, uri),
        kind: hook.kind,
        message,
        remaining,
      });

  const executeStep = async (step: StepModel, remaining: number): Promise<void> => {
    const context: StepContext = { registry, remaining, step, uri };

    let match: ResolvedMatch;

    try {
      match = resolveDispatch({ registry, remaining, step, uri });
    } catch (error) {
      // NOT dispatched — undefined or ambiguous: no definition brackets the
      // step, so NO step hook fires (pinned: run-scenario.lifecycle.test.ts).
      failures.push(error as Error);
      return;
    }

    const stepInfo: StepInfo = { line: step.line, text: step.text, type: step.type };
    const position = { anchor: formatStepAnchor(step, uri), remaining };

    let beforeFailure: Error | undefined;

    for (const hook of matched.beforeStep) {
      try {
        await invokeHook({
          args: [stepInfo],
          format: stepHookFormat(hook, step, remaining),
          hook,
          instance: instances.acquire(hook, position),
        });
      } catch (error) {
        // The step body does NOT run, and the remaining before-step hooks are
        // skipped — setup halts at the first failure (§4).
        beforeFailure = error as Error;
        failures.push(beforeFailure);
        break;
      }
    }

    let result: StepResult;

    if (isUndefined(beforeFailure)) {
      const started = performance.now();

      try {
        const converted = await convertArguments(match, context);
        const instance = instances.acquire(match.definition, position);

        await invokeStep(instance, match, converted, context);
        result = { durationMs: performance.now() - started, status: "passed" };
      } catch (error) {
        failures.push(error as Error);
        result = {
          durationMs: performance.now() - started,
          error: error as Error,
          status: "failed",
        };
      }
    } else {
      // cucumber-js runs after-step hooks even when a before-step hook failed:
      // its runner gates only the STEP BODY on the before-hook result and
      // invokes the after-step hooks unconditionally (cucumber-js
      // src/runtime/test_case_runner.ts `runStep`, read 2026-08-19). The body
      // never ran, so the result the hooks observe is the hook's own failure
      // with zero duration — never "skipped", which is reserved for
      // undispatched steps no hook observes (§4 ⭐). Pinned:
      // run-scenario.lifecycle.test.ts.
      result = { durationMs: 0, error: beforeFailure, status: "failed" };
    }

    // REVERSED at execution: RegistryHooks serves every kind ascending
    // (registry/types.ts) — teardown must unwind setup. EVERY after-step hook
    // runs, pass or fail, and every throw is collected (§4).
    for (const hook of [...matched.afterStep].reverse()) {
      try {
        await invokeHook({
          args: [stepInfo, result],
          format: stepHookFormat(hook, step, remaining),
          hook,
          instance: instances.acquire(hook, position),
        });
      } catch (error) {
        failures.push(error as Error);
      }
    }
  };

  // §3.5's accepted consequence: every binding class declaring a MATCHED
  // scenario- or step-level hook is constructed for EVERY scenario, with the
  // contexts it injects — tag expressions are the opt-out. Construction stops
  // at the first failure; classes after it stay unconstructed, so their
  // after-scenario hooks cannot run (the `get` miss below).
  for (const hook of [
    ...matched.beforeScenario,
    ...matched.afterScenario,
    ...matched.beforeStep,
    ...matched.afterStep,
  ]) {
    try {
      instances.acquire(hook, {
        anchor: scenarioAnchor,
        remaining: scenario.steps.length,
      });
    } catch (error) {
      failures.push(error as Error);
      break;
    }
  }

  if (failures.length === 0) {
    for (const hook of matched.beforeScenario) {
      try {
        await invokeHook({
          args: [],
          format: (message) =>
            formatHookFailure({
              anchor: formatScenarioHookAnchor(
                hook.className,
                hook.methodName,
                scenario,
                uri,
              ),
              kind: hook.kind,
              message,
              remaining: scenario.steps.length,
            }),
          hook,
          instance: instances.acquire(hook, {
            anchor: scenarioAnchor,
            remaining: scenario.steps.length,
          }),
        });
      } catch (error) {
        // Remaining before-scenario hooks are SKIPPED, and so are the steps —
        // but the after-scenario hooks and disposal below still run (§4).
        failures.push(error as Error);
        break;
      }
    }
  }

  let stepsDuration = 0;

  if (failures.length === 0) {
    const started = performance.now();

    for (const [index, step] of scenario.steps.entries()) {
      await executeStep(step, scenario.steps.length - index - 1);

      if (failures.length > 0) {
        // Remaining steps are SKIPPED, not failed — and being undispatched,
        // they run NO step hooks (§4 ⭐).
        break;
      }
    }

    stepsDuration = performance.now() - started;
  }

  // Handed to @AfterScenario as an ARGUMENT — per-invocation data, never an
  // injected token (the injection/argument split, §3.3). durationMs measures
  // the steps phase; zero when it never ran.
  const scenarioResult: ScenarioResult =
    failures.length > 0
      ? { durationMs: stepsDuration, error: failures[0], status: "failed" }
      : { durationMs: stepsDuration, status: "passed" };

  // REVERSED at execution: RegistryHooks serves every kind ascending
  // (registry/types.ts) — teardown must unwind setup. Runs even when a step
  // or before-hook failed; every throw is collected (§4).
  for (const hook of [...matched.afterScenario].reverse()) {
    const instance = instances.get(hook.target);

    if (isUndefined(instance)) {
      // The hook's class never constructed — eager construction stopped at an
      // earlier constructor failure, so there is no instance to run against.
      continue;
    }

    try {
      await invokeHook({
        args: [scenarioResult],
        format: (message) =>
          formatHookFailure({
            anchor: formatScenarioHookAnchor(
              hook.className,
              hook.methodName,
              scenario,
              uri,
            ),
            kind: hook.kind,
            message,
          }),
        hook,
        instance,
      });
    } catch (error) {
      failures.push(error as Error);
    }
  }

  // ALWAYS last, never skipped: a leaked context is cross-scenario
  // contamination. Disposal errors arrive anchored to their context class
  // (create-scenario-container.ts) and are APPENDED — a scenario where ONLY
  // disposal fails is red with the disposal failure primary (§4).
  failures.push(...(await container.dispose()));

  if (failures.length === 0) {
    return;
  }

  throw composeFailures(failures);
};
