import { PickleStepType } from "@cucumber/messages";
import { GherkinError } from "../../errors/GherkinError.js";
import type { StepType } from "./types.js";

/**
 * compile() resolves And/But against the preceding step and maps `*` (and a
 * leading And/But) to Unknown, so every pickle step arrives with one of the
 * four values — `undefined` and unknown values only exist if a future
 * @cucumber/gherkin stops resolving, and must fail loudly here rather than
 * mis-type a snippet.
 */
export const toStepType = (type: PickleStepType | undefined): StepType => {
  switch (type) {
    case PickleStepType.CONTEXT:
      return "Context";

    case PickleStepType.ACTION:
      return "Action";

    case PickleStepType.OUTCOME:
      return "Outcome";

    case PickleStepType.UNKNOWN:
      return "Unknown";

    case undefined:
      throw new GherkinError("Pickle step carries no keyword type", {
        code: "model_invariant",
        details:
          "compile() resolves a keyword type for every pickle step; a step without one means the @cucumber/gherkin dependency changed behaviour underneath the model builder.",
      });

    default: {
      const exhaustive: never = type;
      throw new GherkinError(`Unexpected pickle step type "${String(exhaustive)}"`, {
        code: "model_invariant",
        details:
          "The @cucumber/messages PickleStepType enum gained a value this model builder does not map.",
        data: { type: exhaustive },
      });
    }
  }
};
