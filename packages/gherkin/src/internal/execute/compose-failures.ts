import { formatAdditionalFailures } from "./format/format-additional-failures.js";
import { joinBlocks } from "./format/join-blocks.js";

/**
 * The PRIMARY failure — whichever came first — is the error thrown, with
 * every later failure appended to its message, never replacing it (§4). The
 * primary's INSTANCE is preserved: rethrowing it keeps the stack and any
 * assertion actual/expected pair, so vitest still prints an expect() diff.
 * The caller guarantees a non-empty list.
 */
export const composeFailures = (failures: Array<Error>): Error => {
  const [primary, ...additional] = failures;

  if (additional.length > 0) {
    primary.message = joinBlocks([primary.message, formatAdditionalFailures(additional)]);
  }

  return primary;
};
