import type { Dict } from "@lindorm/types";
import { specByDomain, specByJose } from "../claims/registry.js";
import { CWT_CLAIMS_KIT } from "./cwt-spec.js";

export type EncodeCwtOptions = {
  /**
   * Use compact private-use integer COSE labels (default `true`): claims with a
   * private-use label (`< -65536`) are keyed by that integer on-platform, and the
   * structured `act`/`subjectId` use their compact integer-keyed form. Set `false`
   * for off-platform tokens — those claims are emitted under their JOSE string key
   * instead of the private-use integer label (never dropped), and `act`/`subjectId`
   * are emitted as interoperable string-keyed objects. The flag only chooses
   * digit-vs-string; no claim is ever omitted.
   */
  proprietary?: boolean;
};

/**
 * Encode the DOMAIN-keyed common claims into a CWT claims map (RFC 8392): integer
 * labels where the registry has one, the JOSE string name where it does not, and
 * custom passthrough claims under their literal key. Values are transformed per the
 * registry's value kind (timestamps -> int, cti/hashes -> bstr, …). The returned
 * `Map` is ready to hand to the CBOR encoder.
 *
 * The registry-driven mapping is the `@lindorm/cbor` codec (map mode); the codec
 * keys fields by their JOSE wire name, so known claims are remapped domain -> jose
 * here, and unregistered custom claims — which the codec's spec does not know — are
 * merged in under their literal key.
 */
export const encodeCwtClaims = (
  common: Dict,
  options: EncodeCwtOptions = {},
): Map<number | string, unknown> => {
  const known: Dict = {};
  const custom: Array<[string, unknown]> = [];

  for (const [domain, value] of Object.entries(common)) {
    if (value === undefined) continue;

    const spec = specByDomain(domain);
    if (spec) known[spec.jose] = value;
    else custom.push([domain, value]);
  }

  const map = CWT_CLAIMS_KIT.encode("map", known, {
    proprietary: options.proprietary ?? true,
  });

  for (const [key, value] of custom) map.set(key, value);

  return map;
};

/**
 * Decode a CWT claims map back into the DOMAIN-keyed common shape (integer label /
 * jose string -> domain name; values reversed). Unknown keys are kept verbatim. The
 * result feeds the same verify floor as the JOSE parse.
 *
 * The codec (map mode, lax) reverses the value transforms and keys known claims by
 * their JOSE wire name; that jose -> domain remap and the verbatim custom
 * passthrough happen here.
 */
export const decodeCwtClaims = (map: Map<unknown, unknown>): Dict => {
  const joseKeyed = CWT_CLAIMS_KIT.decode("map", map as Map<number | string, unknown>);

  const common: Dict = {};

  for (const [key, value] of Object.entries(joseKeyed)) {
    const spec = specByJose(key);
    common[spec ? spec.domain : key] = value;
  }

  return common;
};
