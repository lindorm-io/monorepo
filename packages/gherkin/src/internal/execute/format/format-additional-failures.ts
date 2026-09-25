import { isString } from "@lindorm/is";
import { indent } from "./indent.js";
import { joinBlocks } from "./join-blocks.js";

const formatEntry = (error: Error, index: number): string => {
  const label = `  ${index + 1}) `;
  // Any error carrying a string `code` gets a code line — runner-owned
  // (disposal_failed, …) and consumer alike, read off the property rather than
  // the prototype, so a second installed copy of this package renders the same.
  const code = (error as { code?: unknown }).code;
  const message = isString(code) ? `${code}\n\n${error.message}` : error.message;

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
