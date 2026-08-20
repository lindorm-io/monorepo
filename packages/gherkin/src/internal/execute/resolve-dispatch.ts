import { isUndefined } from "@lindorm/is";
import { GherkinError } from "../../errors/GherkinError.js";
import type { StepModel } from "../model/types.js";
import type { GherkinRegistry, ResolvedMatch } from "../registry/types.js";
import { formatAmbiguousStep } from "./format/format-ambiguous-step.js";
import { formatUndefinedStep } from "./format/format-undefined-step.js";
import { generateSnippet } from "./format/generate-snippet.js";

export type ResolveDispatchOptions = {
  registry: GherkinRegistry;
  /** Steps after this one — they are never executed once this one fails. */
  remaining: number;
  step: StepModel;
  uri: string;
};

/**
 * Decides whether the step DISPATCHES to exactly one definition, throwing the
 * anchored failure when it does not. A step that fails here runs NO
 * `@BeforeStep`/`@AfterStep` — there is no definition to bracket, and a hook
 * observing a step that never executed would be the manufactured-green class
 * (§4; pinned: run-scenario.lifecycle.test.ts).
 */
export const resolveDispatch = ({
  registry,
  remaining,
  step,
  uri,
}: ResolveDispatchOptions): ResolvedMatch => {
  const match = registry.match(step.text);

  if (isUndefined(match)) {
    throw new GherkinError(
      formatUndefinedStep({
        remaining,
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
      formatAmbiguousStep({ candidates: match.candidates, remaining, step, uri }),
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

  return match;
};
