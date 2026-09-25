import { GherkinError } from "../../../errors/GherkinError.js";
import type { StepType } from "../../model/types.js";

/**
 * Pickle steps carry no literal keyword, so failure messages render one from
 * the resolved type. `Unknown` (a `*` step, or a leading And/But) renders as
 * `*` — the closest to what the author wrote.
 */
export const toDisplayKeyword = (type: StepType): string => {
  switch (type) {
    case "Context":
      return "Given";

    case "Action":
      return "When";

    case "Outcome":
      return "Then";

    case "Unknown":
      return "*";

    default: {
      const exhaustive: never = type;
      throw new GherkinError(`Unexpected step type "${String(exhaustive)}"`, {
        code: "model_invariant",
        details: "The StepType union gained a value this renderer does not map.",
        data: { type: exhaustive },
      });
    }
  }
};
