import type { TokenProfileTyp } from "../../types/index.js";

/**
 * Map a profile's JOSE `typ` to the COSE `typ`. RFC 9596. A COSE object is a CWT,
 * so the `+jwt` structured suffix becomes `+cwt`, and the value keeps its full
 * `application/...` media type rather than the JWS abbreviation. The bare `JWT`
 * maps to `application/cwt`; `presence: "none"` maps to `undefined`.
 *
 * ⚠ Only `application/cwt` is registered — the per-profile `+cwt` types are
 * lindorm-proprietary, as COSE has no equivalent of RFC 9068's `at+jwt`.
 */
export const coseTyp = (typ: TokenProfileTyp): string | undefined => {
  if (typ.presence === "none") return undefined;
  if (typ.value.endsWith("+jwt")) return `${typ.value.slice(0, -4)}+cwt`;
  return "application/cwt";
};
