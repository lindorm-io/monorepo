import { GherkinError } from "../../../errors/GherkinError.js";
import type { StepType } from "../../model/types.js";

/**
 * The decorator an undefined-step snippet emits, from the pickle step's
 * resolved type. `Unknown` maps to no decorator of its own, so it falls back
 * to `Given` — the snippet must stay pasteable for a `*` step too.
 */
export const toSnippetDecorator = (type: StepType): "Given" | "When" | "Then" => {
  switch (type) {
    case "Context":
      return "Given";

    case "Action":
      return "When";

    case "Outcome":
      return "Then";

    case "Unknown":
      return "Given";

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
