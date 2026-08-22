import type { Dict } from "@lindorm/types";
import type { InvalidEntry, ShapeRuleName } from "../../types/index.js";
import {
  actChainShape,
  cnfShape,
  crossField,
  eventsShape,
  subIdShape,
} from "../utils/rules/index.js";

/**
 * The structural validators a `shape` policy rule may name — the ONE place a name
 * is bound to an implementation. A profile names a rule instead of carrying a
 * function, which keeps the whole policy plain data and stops a profile smuggling
 * in a validator nobody else can see.
 *
 * `Record<ShapeRuleName, …>` is TOTAL, so a new name is a build failure here rather
 * than a lookup resolving to `undefined` at enforcement time.
 */
export const SHAPE_RULES: Record<ShapeRuleName, (claims: Dict) => Array<InvalidEntry>> = {
  actChain: actChainShape,
  confirmation: cnfShape,
  crossField,
  events: eventsShape,
  subjectId: subIdShape,
};
