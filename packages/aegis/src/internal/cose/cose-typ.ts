import type { TokenType } from "../../constants/token-type.js";
import type { TokenProfileTyp } from "../../types/index.js";
import { computeTypHeader } from "../utils/compute-typ-header.js";

/**
 * Map a profile's JOSE `typ` to the COSE `typ` (label 16, RFC 9596). A COSE
 * object is a CWT, not a JWT, so the `+jwt` structured suffix becomes `+cwt`;
 * the value keeps its full `application/...` media type (COSE does not use the
 * JWS abbreviation that drops `application/` — RFC 9596 → RFC 9052 §3.1):
 *
 *   { presence: "required", value: "application/at+jwt" } -> application/at+cwt
 *   { presence: "required", value: "application/secevent+jwt" }
 *                                                          -> application/secevent+cwt
 *   { presence: "required", value: "JWT" }                 -> application/cwt
 *                                       (the one registered CWT type, RFC 8392
 *                                        — bare JWT has no structured equivalent)
 *   { presence: "none" }                                   -> undefined
 *                                       (profile mandates no typ)
 *
 * NOTE: only `application/cwt` is IANA-registered; the per-profile `+cwt` types
 * are lindorm-proprietary (no CWT equivalent of RFC 9068's `at+jwt` exists).
 */
export const coseTyp = (typ: TokenProfileTyp): string | undefined => {
  if (typ.presence === "none") return undefined;
  if (typ.value.endsWith("+jwt")) return `${typ.value.slice(0, -4)}+cwt`;
  return "application/cwt";
};

/**
 * The COSE `typ` for the RAW (profile-less) sign path, derived straight from a bare
 * `tokenType`. Reuses `computeTypHeader` — so a token type's validation (no whitespace,
 * no `+`, no empty string) and its short-name lookup are shared with the JOSE path — then
 * swaps the structured `+jwt` suffix for `+cwt`. A type with no structured JOSE form (a
 * bare `JWT`, or no `tokenType` at all) becomes the one registered CWT media type,
 * `application/cwt`, mirroring `coseTyp`'s fallback.
 */
export const coseTypFromTokenType = (tokenType: TokenType | undefined): string => {
  const jose = computeTypHeader(tokenType, "jwt");

  return jose.endsWith("+jwt") ? `${jose.slice(0, -4)}+cwt` : "application/cwt";
};
