import type { AmphoraCondition } from "../types/index.js";
import { omitUnspecified } from "../internal/utils/omit-unspecified.js";

/**
 * Merge caller-supplied condition layers, later wins, with each layer's
 * `undefined` values STRIPPED first.
 *
 * The strip is LAYERING semantics, and that is why it stays: a later layer's
 * `{ x: undefined }` must not erase an earlier layer's real `x` — which is how a
 * per-call undefined silently deletes a deployment allowlist. Without it,
 * `mergeConditions({ issuer: "a" }, { issuer: undefined })` yields
 * `{ issuer: undefined }`, when the only correct answer is `"a"`.
 *
 * That reason stands ALONE, and it has to: `@lindorm/match` does not reject an
 * `undefined` condition value, it IGNORES it — `undefined` ≡ absent, everywhere,
 * by ruling. So nothing below this catches a layer that erased a real value; by
 * the time the matcher sees `{ issuer: undefined }` the `"a"` is already gone
 * and the query silently matches every issuer. The MEANING of `undefined` is the
 * matcher's; what a caller's LAYERS compose to is this function's, and only this
 * function is in a position to know.
 *
 * The same strip runs once more at amphora's own public boundary
 * ({@link omitUnspecified}) — not a second copy of this one, but the other half:
 * this covers conditions that are MERGED, that covers every condition, merged or
 * not, before anything downstream inspects its shape.
 *
 * A spread reduce rather than `Object.assign`: `Object.assign` accepts ANY
 * source, so a typo'd or stale property attaches silently instead of failing
 * the build — in the path that decides which key answers a security question.
 */
export const mergeConditions = (
  ...layers: Array<AmphoraCondition | null | undefined>
): AmphoraCondition =>
  layers.reduce<AmphoraCondition>(
    (merged, layer) => (layer ? { ...merged, ...omitUnspecified(layer) } : merged),
    {},
  );

/**
 * Apply a non-negotiable FLOOR over caller layers. The floor is spread LAST, so
 * a caller can never override it — `use`, `hasPrivateKey`, the lifetime states.
 * That is what a floor IS. Caller layers are strip-merged first (see above).
 */
export const applyKeyFloor = (
  floor: AmphoraCondition,
  ...layers: Array<AmphoraCondition | null | undefined>
): AmphoraCondition => ({ ...mergeConditions(...layers), ...floor });
