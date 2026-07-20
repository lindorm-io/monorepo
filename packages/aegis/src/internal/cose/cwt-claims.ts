import type { Dict } from "@lindorm/types";
import { claimByCoseName } from "../claims/claims-registry.js";
import { CWT_CLAIMS_KIT } from "./cwt-spec.js";

export type EncodeCwtOptions = {
  /**
   * Use compact private-use integer COSE labels (default `false` — D5: the
   * non-proprietary default MUST be fully interoperable). When `false` (default)
   * a claim with a private-use label (`< -65536`) is emitted under its JOSE
   * string key (never dropped) and the structured `act`/`subjectId` are emitted
   * as interoperable string-keyed objects. Set `true` for on-platform tokens —
   * those claims are keyed by their compact private-use integer label instead,
   * and `act`/`subjectId` use their compact integer-keyed form. The flag only
   * chooses digit-vs-string; no claim is ever omitted.
   */
  proprietary?: boolean;
};

/**
 * Encode ALREADY-WIRE (COSE-name-keyed) claims — the `domainToCose` output — into
 * a CWT claims map (RFC 8392): integer labels where the registry has one, the wire
 * string name where it does not, and custom passthrough claims under their literal
 * key. This is the codec ONLY: the domain -> wire translation (name + value shape)
 * happens in `domainToCose` before this is called, so there is no domain-remap loop
 * here anymore.
 *
 * The registry-driven mapping is the `@lindorm/cbor` codec (map mode), keyed by the
 * COSE name; it turns the wire-shaped values into COSE labels / CBOR bytes (cti/
 * hashes -> bstr, `cnf` -> COSE_Key map, `act`/`sub_id` -> compact maps). Custom
 * claims — which the codec's spec does not know — are merged in under their literal
 * (already snake_cased) key.
 */
export const encodeCwtClaims = (
  wire: Dict,
  options: EncodeCwtOptions = {},
): Map<number | string, unknown> => {
  const map = CWT_CLAIMS_KIT.encode("map", wire, {
    proprietary: options.proprietary ?? false,
  });

  // Unregistered custom claims are unknown to the codec spec, so it never emits
  // them — add them under their literal wire key (present-only, matching the codec).
  for (const [key, value] of Object.entries(wire)) {
    if (value === undefined) continue;
    if (claimByCoseName(key)) continue;
    map.set(key, value);
  }

  return map;
};

/**
 * Decode a CWT claims map into the COSE-name-keyed WIRE shape (integer label /
 * wire string -> wire name; values de-serialized). Unknown labels are kept verbatim
 * under their wire key. This is the codec ONLY — `coseToDomain` maps the result to
 * the domain shape (the read twin of `domainToCose` -> `encodeCwtClaims`).
 */
export const decodeCwtClaims = (map: Map<unknown, unknown> | Dict): Dict => {
  // The byte decoder runs `preferMap: false`, which keeps the top CWT map a `Map`
  // only while it has integer keys — the usual case, since registered claims carry
  // integer labels. A CWT whose claims are ALL custom (string-keyed) — e.g. an
  // opaque handle `{tid, sec}` — has no integer key, so it decodes as a plain
  // object instead. Normalise it back to a Map here (top level only; nested claim
  // objects stay plain, as intended) so the codec always sees a Map.
  const asMap: Map<number | string, unknown> =
    map instanceof Map
      ? (map as Map<number | string, unknown>)
      : new Map(Object.entries(map));

  return CWT_CLAIMS_KIT.decode("map", asMap);
};
