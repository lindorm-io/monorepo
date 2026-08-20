import type { PickleStepArgument } from "@cucumber/messages";
import { isObject, isUndefined } from "@lindorm/is";
import { GherkinError } from "../../errors/GherkinError.js";
import type { StepArgumentModel } from "./types.js";

/**
 * Maps a pickle step's argument to its model form. Content is carried
 * VERBATIM — the emitter's JSON.stringify keeps hostile characters data —
 * and table cells arrive `<placeholder>`-substituted because compile()
 * interpolates outline values into DocString bodies and table cells exactly
 * as into step text (pinned: build-feature-model.test.ts).
 */
export const toStepArgumentModel = (argument: PickleStepArgument): StepArgumentModel => {
  if (isObject(argument.docString)) {
    return {
      kind: "doc-string",
      content: argument.docString.content,
      // Conditional spread, never `key: undefined` — the transform
      // JSON.stringifies the model, and an absent key must stay absent so
      // identical input keeps emitting byte-identical source.
      ...(isUndefined(argument.docString.mediaType)
        ? {}
        : { mediaType: argument.docString.mediaType }),
    };
  }

  if (isObject(argument.dataTable)) {
    return {
      kind: "data-table",
      rows: argument.dataTable.rows.map((row) => row.cells.map((cell) => cell.value)),
    };
  }

  // The messages type allows both members absent; the parser never emits
  // that, so reaching here means the model would silently drop data.
  throw new GherkinError("Pickle step argument carries no DocString and no DataTable", {
    code: "model_invariant",
    title: "Model Invariant Violated",
    details:
      "A pickle step argument must hold either a DocString or a DataTable — an empty argument object means the parser contract changed underneath this model.",
    data: { argument },
  });
};
