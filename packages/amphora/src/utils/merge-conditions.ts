import { omitUndefined } from "@lindorm/utils";
import type { AmphoraCondition } from "../types/index.js";

/**
 * Merge caller-supplied condition layers, later wins, with each layer's
 * `undefined` values STRIPPED first. Stripping per-layer is load-bearing: a
 * later layer's `{ x: undefined }` must not erase an earlier layer's real `x`
 * (which is how a per-call undefined silently deletes a deployment allowlist),
 * and an `undefined` value must not survive to become match-all in `Matcher`.
 */
export const mergeConditions = (
  ...layers: Array<AmphoraCondition | null | undefined>
): AmphoraCondition =>
  Object.assign({}, ...layers.filter(Boolean).map((layer) => omitUndefined(layer!)));

/**
 * Apply a non-negotiable FLOOR over caller layers. The floor is spread LAST, so
 * a caller can never override it — `use`, `hasPrivateKey`, the lifetime states.
 * That is what a floor IS. Caller layers are strip-merged first (see above).
 */
export const applyKeyFloor = (
  floor: AmphoraCondition,
  ...layers: Array<AmphoraCondition | null | undefined>
): AmphoraCondition => ({ ...mergeConditions(...layers), ...floor });
