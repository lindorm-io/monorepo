import type { Examples, TableRow } from "@cucumber/messages";
import { isObject } from "@lindorm/is";
import { GherkinError } from "../../errors/GherkinError.js";

/**
 * An Examples block with a non-empty tableBody always carries a tableHeader —
 * the table's first row IS the header, and the parser rejects a ragged table
 * ("inconsistent cell count within the table") — but the messages type leaves
 * `tableHeader` optional, so guard rather than trust it.
 */
export const requireTableHeader = (examples: Examples): TableRow => {
  if (isObject<TableRow>(examples.tableHeader)) {
    return examples.tableHeader;
  }

  throw new GherkinError("Examples block carries data rows but no header row", {
    code: "model_invariant",
    title: "Model Invariant Violated",
    details:
      "A non-empty Examples table always parses with its first row as the header — a miss means the @cucumber/gherkin dependency changed behaviour underneath the model builder.",
    data: { line: examples.location.line },
  });
};
