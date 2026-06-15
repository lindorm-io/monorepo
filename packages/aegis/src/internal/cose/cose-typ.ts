/**
 * Map a profile's JOSE `typ` to the COSE `typ` (label 16, RFC 9596). A COSE
 * object is a CWT, not a JWT, so the `+jwt` structured suffix becomes `+cwt`;
 * the value keeps its full `application/...` media type (COSE does not use the
 * JWS abbreviation that drops `application/` — RFC 9596 → RFC 9052 §3.1):
 *
 *   application/at+jwt        -> application/at+cwt
 *   application/secevent+jwt  -> application/secevent+cwt
 *   JWT                       -> application/cwt   (the one registered CWT type,
 *                                                   RFC 8392 — bare JWT has no
 *                                                   structured equivalent)
 *   null                      -> undefined         (profile mandates no typ)
 *
 * NOTE: only `application/cwt` is IANA-registered; the per-profile `+cwt` types
 * are lindorm-proprietary (no CWT equivalent of RFC 9068's `at+jwt` exists).
 */
export const coseTyp = (joseTyp: string | null): string | undefined => {
  if (joseTyp === null) return undefined;
  if (joseTyp.endsWith("+jwt")) return `${joseTyp.slice(0, -4)}+cwt`;
  return "application/cwt";
};
