import type { Dict } from "@lindorm/types";
import { claimByCoseName } from "../claims/claims-registry.js";
import { CWT_CLAIMS_KIT } from "./cwt-spec.js";

export type EncodeCwtOptions = {
  /**
   * Use compact private-use integer COSE labels. Default `false`: a claim with a
   * private-use label (`< -65536`) is emitted under its JOSE string key and the
   * structured claims are string-keyed, so an interoperable reader can read the
   * token. `true` keys them by their compact integer label instead.
   *
   * ⚠ The flag chooses digit-vs-string only; no claim is ever omitted.
   */
  proprietary?: boolean;
};

/**
 * Encode ALREADY-WIRE (COSE-name-keyed) claims into a CWT claims map (RFC 8392):
 * integer labels where the registry has one, the wire string name where it does
 * not, custom claims under their literal key.
 *
 * ⚠ The codec ONLY. `domainToWire` does the domain -> wire translation (name and
 * value shape) before this runs, so there is no domain remap here.
 */
export const encodeCwtClaims = (
  wire: Dict,
  options: EncodeCwtOptions = {},
): Map<number | string, unknown> => {
  const map = CWT_CLAIMS_KIT.encode("map", wire, {
    proprietary: options.proprietary ?? false,
  });

  // The codec spec does not know unregistered custom claims, so they are merged in
  // under their literal wire key.
  for (const [key, value] of Object.entries(wire)) {
    if (value === undefined) continue;
    if (claimByCoseName(key)) continue;
    map.set(key, value);
  }

  return map;
};

/**
 * Decode a CWT claims map into the COSE-name-keyed WIRE shape; unknown labels are
 * kept verbatim under their wire key. The codec ONLY — `wireToDomain` maps the
 * result to the domain shape.
 */
export const decodeCwtClaims = (map: Map<unknown, unknown> | Dict): Dict => {
  // ⚠ `preferMap: false` keeps the top CWT map a `Map` only while it has integer
  // keys, so a CWT whose claims are ALL custom decodes as a plain object.
  // Normalised back to a Map here — top level only; nested claim objects stay
  // plain — so the codec always sees a Map.
  const asMap: Map<number | string, unknown> =
    map instanceof Map
      ? (map as Map<number | string, unknown>)
      : new Map(Object.entries(map));

  // ⚠ The decoded claims object is prototype-safe, and NOT because of anything
  // here: `@lindorm/cbor` writes every `lax`-mode member with
  // `Object.defineProperty`, so a foreign CWT's `__proto__` claim key lands as an
  // ordinary OWN key. That matters because registered claims are read off this bag
  // BY PROPERTY — an inherited `aud` would answer as though the issuer stated it,
  // on a token whose signature verifies.
  //
  // ⛔ Rebuilding the object here is a NO-OP, so it would be a guard whose removal
  // cannot turn a test red. The consequence is pinned in
  // `internal/claims/claims-proto-forgery.test.ts`.
  return CWT_CLAIMS_KIT.decode("map", asMap);
};
