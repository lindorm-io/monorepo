import type { Condition } from "@lindorm/match";
import { Matcher } from "@lindorm/match";
import type { Dict } from "@lindorm/types";

/**
 * The boolean form of the claim check — "do these claims satisfy the predicate?".
 * {@link import("./validate.js").validate} is the throwing layer over it (match,
 * then diagnose the failing keys), so the two forms can never answer differently.
 */
export const matches = <C extends Dict = Dict>(
  dict: C,
  predicate: Condition<C>,
): boolean => Matcher.match(dict, predicate);
