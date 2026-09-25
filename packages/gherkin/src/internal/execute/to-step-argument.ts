import { isUndefined } from "@lindorm/is";
import { DataTable } from "../../classes/DataTable.js";
import { DocString } from "../../classes/DocString.js";
import { GherkinError } from "../../errors/GherkinError.js";
import type { StepArgumentModel } from "../model/types.js";

/**
 * Materializes the model's step argument into the value the TRAILING slot
 * carries — `undefined` when the step has none. The slot itself is passed
 * unconditionally (run-scenario.ts): the argument position must never shift
 * with the argument's presence (§3.6 — @amiceli filters null out, so a
 * table's absence silently moves every parameter one place left).
 */
export const toStepArgument = (
  argument?: StepArgumentModel,
): DataTable | DocString | undefined => {
  if (isUndefined(argument)) {
    return undefined;
  }

  switch (argument.kind) {
    case "doc-string":
      return new DocString({
        content: argument.content,
        ...(isUndefined(argument.mediaType) ? {} : { mediaType: argument.mediaType }),
      });

    case "data-table":
      // The DataTable constructor copies — the baked model rows can never be
      // corrupted through the instance handed to the step.
      return new DataTable(argument.rows);

    default: {
      const exhaustive: never = argument;
      throw new GherkinError("Unexpected step argument kind", {
        code: "model_invariant",
        details: "The StepArgumentModel union gained a kind this factory does not map.",
        data: { argument: exhaustive },
      });
    }
  }
};
