import type { Condition } from "@lindorm/match";
import type { Dict } from "@lindorm/types";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError.js";
import { analyzeRestriction } from "./analyze-restriction.js";

/**
 * Refuse a destructive operation whose criteria restrict NOTHING.
 *
 * The guard this replaces counted `Object.keys(criteria).length`, which answers
 * a different question from the one its own error text asked. Four shapes had
 * one key, passed, and affected every row — verified against a real sqlite
 * database and the in-memory driver at the time of writing:
 * `{ $and: [] }`, `{ name: {} }`, `{ name: undefined }` and
 * `{ tag: { $nin: [] } }`.
 *
 * `always-false` criteria are allowed through: matching no rows is a legitimate
 * outcome, and refusing it would make an empty `$in` list harder to write than
 * the unrestricted spelling.
 *
 * Saying "every row" explicitly is what `deleteAll()` and `updateAll()` are for,
 * which is what lets this guard be absolute rather than something to be tricked
 * past with a criterion that happens to compile away.
 */
export const guardUnrestrictedCriteria = (
  criteria: Condition<Dict>,
  operation: string,
): void => {
  if (analyzeRestriction(criteria) !== "always-true") return;

  throw new ProteusRepositoryError(`${operation} requires restrictive criteria`, {
    code: "unrestricted_criteria",
    title: "Unrestricted Criteria",
    details: `The criteria passed to ${operation} place no restriction, so it would affect every row. Add a criterion, or call ${operation === "updateMany" ? "updateAll()" : "deleteAll()"} to say so explicitly.`,
    data: { operation },
  });
};
