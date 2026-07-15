import { removeUndefined } from "@lindorm/utils";
import type { AmphoraPredicate } from "../types/index.js";

/**
 * Merge caller-supplied predicate layers, later wins, with each layer's
 * `undefined` values STRIPPED first. Stripping per-layer is load-bearing: a
 * later layer's `{ x: undefined }` must not erase an earlier layer's real `x`
 * (which is how a per-call undefined silently deletes a deployment allowlist),
 * and an `undefined` value must not survive to become match-all in `Predicated`.
 */
export const mergePredicates = (
  ...layers: Array<AmphoraPredicate | null | undefined>
): AmphoraPredicate =>
  Object.assign({}, ...layers.filter(Boolean).map((layer) => removeUndefined(layer!)));

/**
 * Apply a non-negotiable FLOOR over caller layers. The floor is spread LAST, so
 * a caller can never override it — `use`, `hasPrivateKey`, the lifetime states.
 * That is what a floor IS. Caller layers are strip-merged first (see above).
 */
export const applyKeyFloor = (
  floor: AmphoraPredicate,
  ...layers: Array<AmphoraPredicate | null | undefined>
): AmphoraPredicate => ({ ...mergePredicates(...layers), ...floor });
