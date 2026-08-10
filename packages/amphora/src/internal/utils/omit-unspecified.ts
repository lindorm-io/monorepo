import { isUndefined } from "@lindorm/is";
import type { AmphoraCondition } from "../../types/index.js";

/**
 * Drop every condition key whose value is `undefined`, so that within amphora
 * "present" and "SPECIFIED" are the same thing.
 *
 * `undefined` ≡ ABSENT is the language's rule: `@lindorm/match` treats an
 * `undefined` condition value as no constraint, deliberately, so a caller
 * writing `{ publish: cfg.publish }` against an unset config field has asked
 * nothing about `publish`. Anything that INSPECTS a condition — rather than
 * evaluating it — must read that same meaning, and key presence does not: `in`
 * is true for a key holding `undefined`. Normalising once at the public boundary
 * is what lets every reader downstream use presence safely, instead of each one
 * having to remember the distinction (`AmphoraState.filteredKeys` skipping its
 * publish gate is what that costs — it handed internal unpublished keys to a
 * caller who asked for published ones).
 *
 * ⚠ TOP-LEVEL ONLY, and deliberately not `omitUndefined` from `@lindorm/utils`,
 * which recurses. A condition value may be an operator object whose operand is
 * not a plain one — a `RegExp` has no own enumerable properties, so a recursive
 * rebuild turns `{ $regex: /^cookie/ }` into `{ $regex: {} }`, silently widening
 * the very query this exists to keep honest. Nothing reads a condition's NESTED
 * shape, so nothing needs the recursion.
 */
export const omitUnspecified = (condition: AmphoraCondition): AmphoraCondition =>
  Object.entries(condition).reduce<AmphoraCondition>(
    (result, [key, value]) => (isUndefined(value) ? result : { ...result, [key]: value }),
    {},
  );
