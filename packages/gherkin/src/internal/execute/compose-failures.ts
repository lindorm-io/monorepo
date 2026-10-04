import { formatAdditionalFailures } from "./format/format-additional-failures.js";
import { joinBlocks } from "./format/join-blocks.js";
import { readMessage } from "./read-consumer-value.js";

/** The caller guarantees a non-empty list. */
export const composeFailures = (failures: Array<Error>): Error => {
  const [primary, ...additional] = failures;

  if (additional.length === 0) {
    return primary;
  }

  return new Error(
    joinBlocks([readMessage(primary), formatAdditionalFailures(additional)]),
    {
      cause: primary,
    },
  );
};
