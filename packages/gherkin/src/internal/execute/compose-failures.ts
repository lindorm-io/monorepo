import { formatAdditionalFailures } from "./format/format-additional-failures.js";
import { joinBlocks } from "./format/join-blocks.js";

/** The caller guarantees a non-empty list. */
export const composeFailures = (failures: Array<Error>): Error => {
  const [primary, ...additional] = failures;

  if (additional.length === 0) {
    return primary;
  }

  return new Error(joinBlocks([primary.message, formatAdditionalFailures(additional)]), {
    cause: primary,
  });
};
