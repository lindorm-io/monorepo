import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";

/**
 * For each group, at least one of its claims must be present. e.g. the logout
 * token's `[["sub", "sid"]]` — at least one of `sub`/`sid` is required.
 */
export const atLeastOneOf = (
  claims: Dict,
  groups: Array<Array<string>>,
): Array<InvalidEntry> => {
  const invalid: Array<InvalidEntry> = [];

  for (const group of groups) {
    if (!group.some((key) => claims[key] !== undefined)) {
      invalid.push({
        key: group.join("|"),
        message: `At least one of [${group.join(", ")}] is required`,
      });
    }
  }

  return invalid;
};
