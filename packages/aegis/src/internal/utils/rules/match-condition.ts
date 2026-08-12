import type { Condition } from "@lindorm/match";
import { Matcher } from "@lindorm/match";
import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";

/**
 * Evaluate a flat rule predicate over the DOMAIN-keyed claim layer — the
 * implementation behind a `match` policy rule.
 *
 * On a mismatch each field key is re-checked in isolation so the failure names
 * exactly which claim(s) missed; logical top-level keys (`$and`/`$or`/`$not`)
 * cannot be attributed to one claim and collapse to a single entry. Mirrors the
 * per-field diagnosis in `internal/utils/validate.ts`.
 */
export const matchCondition = (
  claims: Dict,
  condition: Condition<Dict>,
): Array<InvalidEntry> => {
  if (Matcher.match(claims, condition)) return [];

  const invalid: Array<InvalidEntry> = [];

  for (const [key, ops] of Object.entries(condition)) {
    if (key.startsWith("$")) {
      invalid.push({
        key: "rules",
        message: "The claims did not satisfy the profile rule predicate",
      });
      continue;
    }
    if (!Matcher.match({ [key]: claims[key] }, { [key]: ops } as Condition<Dict>)) {
      invalid.push({
        key,
        message: `Claim "${key}" did not satisfy the profile rule predicate`,
      });
    }
  }

  return invalid;
};
