import type { Dict } from "@lindorm/types";
import { omitEmpty, omitUndefined } from "@lindorm/utils";

/**
 * How aggressively a minted token's claim dict is pruned at the emission
 * boundary:
 *
 * - `"empty"` (default) — drop `undefined`, `null`, `""`, `[]`, and `{}`
 *   recursively, so the wire stays COMPACT.
 * - `"undefined"` — drop only `undefined`, preserving explicit empty values.
 */
export type OmitMode = "empty" | "undefined";

/**
 * Claims whose empty containers are STRUCTURALLY meaningful and must survive the
 * `"empty"` prune verbatim. `events` (RFC 8417 SET / OIDC logout) maps each
 * event-type URI to a payload object that is routinely empty (`{}`, e.g.
 * back-channel logout) — dropping it would lose the event itself, and `events`
 * is a REQUIRED claim on the SET/logout/erasure profiles. These keys are the
 * same on the domain layer (COSE `common`) and the JOSE wire, so protecting the
 * key covers both wires.
 */
const PROTECTED_KEYS = new Set(["events"]);

/**
 * The single strip applied to the final claims dict just before it is signed /
 * encoded — shared by JOSE and COSE so both wires behave identically. `"empty"`
 * is the default: emitted tokens are compact unless the caller opts back into
 * the historical undefined-only stripping with `"undefined"`.
 */
export const applyOmit = <T extends Dict = Dict>(
  dict: T,
  mode: OmitMode = "empty",
): T => {
  if (mode === "undefined") return omitUndefined(dict);

  // Split the protected claims out so omitEmpty neither recurses into nor drops
  // them, prune the remainder, then merge them back. An undefined protected
  // claim is left to the normal prune (it must not be re-materialised as
  // `events: undefined`).
  const protectedEntries: Dict = {};
  const rest: Dict = {};

  for (const [key, value] of Object.entries(dict)) {
    if (value !== undefined && PROTECTED_KEYS.has(key)) protectedEntries[key] = value;
    else rest[key] = value;
  }

  return { ...omitEmpty(rest), ...protectedEntries } as T;
};
