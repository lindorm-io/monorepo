import type { Dict } from "@lindorm/types";
import { isNotStated } from "./is-not-stated.js";

/**
 * Drop the top-level keys whose value is not stated: `null` is absence at the
 * claim key on every door, a member is the walker's question
 * (`internal/claims/translate.ts`), and a nested value is not this helper's.
 *
 * ⛔ `Object.fromEntries`, never `result[key] = value` — the keys are the
 * caller's, so an own `__proto__` must stay an own key.
 */
export const omitNotStated = <T extends Dict = Dict>(dict: T): T =>
  Object.fromEntries(
    Object.entries(dict).filter(([, value]) => !isNotStated(value)),
  ) as T;
