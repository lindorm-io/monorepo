import type { Dict } from "@lindorm/types";
import type { InvalidEntry, ShapeRuleName } from "../../types/index.js";
import {
  actChainShape,
  cnfShape,
  crossField,
  eventsShape,
  everyElementHasKey,
  subIdShape,
} from "../utils/rules/index.js";

/**
 * The structural validators a `shape` policy rule may name — the ONE place a
 * name is bound to an implementation.
 *
 * A profile names a rule instead of carrying a function, which is what makes the
 * whole policy plain data: a rule list can be read, compared and (eventually)
 * serialised without executing it, and a profile cannot smuggle in a validator
 * nobody else can see.
 *
 * `Record<ShapeRuleName, …>` is TOTAL, so a new name is a build failure here
 * rather than a lookup that resolves to `undefined` at enforcement time.
 */
export const SHAPE_RULES: Record<ShapeRuleName, (claims: Dict) => Array<InvalidEntry>> = {
  actChain: actChainShape,
  // RFC 9396 — every `authorization_details` element is an object with a `type`.
  authorizationDetails: (claims) =>
    everyElementHasKey(claims, "authorizationDetails", "type"),
  confirmation: cnfShape,
  crossField,
  events: eventsShape,
  subjectId: subIdShape,
};
