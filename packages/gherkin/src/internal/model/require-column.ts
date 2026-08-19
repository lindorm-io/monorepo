import type { Location } from "@cucumber/messages";
import { isNumber } from "@lindorm/is";
import { GherkinError } from "../../errors/GherkinError.js";

/**
 * Failure anchors render `uri:line:column`, and the parser reports the
 * KEYWORD's column (`Given` / `Scenario:` / `Examples:` / a table row's
 * leading `|`) on every location it produces — but the messages type leaves
 * `column` optional, so guard rather than trust it. Pinned:
 * build-feature-model.test.ts asserts keyword columns end to end.
 */
export const requireColumn = (location: Location): number => {
  if (isNumber(location.column)) {
    return location.column;
  }

  throw new GherkinError("AST location carries no column", {
    code: "model_invariant",
    title: "Model Invariant Violated",
    details:
      "Every location the Gherkin parser produces carries a column — a miss means the @cucumber/gherkin dependency changed behaviour underneath the model builder.",
    data: { line: location.line },
  });
};
