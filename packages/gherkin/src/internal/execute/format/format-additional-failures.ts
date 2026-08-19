import { LindormError } from "@lindorm/errors";
import { indent } from "./indent.js";
import { joinBlocks } from "./join-blocks.js";

const formatEntry = (error: Error, index: number): string => {
  const label = `  ${index + 1}) `;
  // Carries a lindorm urn ⇒ urn line — the error's OWN type, which is
  // informative whether the failure is runner-owned (disposal_failed, …) or a
  // consumer hook rethrowing its own LindormError. The instanceof is safe in
  // the load-bearing direction: runner-owned GherkinErrors share this module
  // graph, so no false negative; a dual-install consumer LindormError merely
  // degrades to the plain consumer rendering.
  const message =
    error instanceof LindormError ? `${error.type}\n\n${error.message}` : error.message;

  // Indent the whole message to the label's width, then splice the label into
  // the first line — multi-line messages stay aligned under their number.
  return label + indent(message, label.length).slice(label.length);
};

/**
 * The appendix a scenario failure carries when more than one thing failed:
 * hook and disposal failures are APPENDED after the primary failure, never
 * replacing it (§4 of the failure contract — compose-failures.ts).
 */
export const formatAdditionalFailures = (errors: Array<Error>): string =>
  joinBlocks([
    `${errors.length} additional ${errors.length === 1 ? "failure" : "failures"} followed the one above:`,
    ...errors.map(formatEntry),
  ]);
