import type {
  BaseTokenFormat,
  DomainTokenHeader,
  TokenFormatTag,
  WireTokenHeader,
} from "../../types/index.js";
import { decodeTokenTypeFromTyp } from "./compute-typ-header.js";
import { parseTokenHeader } from "./token-header.js";

/**
 * The JOSE family a format belongs to, or `undefined` for a COSE one. A COSE
 * object is not a JOSE member, so `baseFormat` — a JOSE-family discriminant — has
 * nothing to say about it; the result's own `format` tells the two families apart.
 */
const BASE_FORMAT: Record<TokenFormatTag, BaseTokenFormat | undefined> = {
  jwt: "JWT",
  jws: "JWS",
  jwe: "JWE",
  cwt: undefined,
  cwm: undefined,
  cws: undefined,
  cwe: undefined,
};

/**
 * Recover the domain `tokenType` from a COSE `typ`. COSE spells the structured
 * media type `+cwt` where JOSE spells it `+jwt`, so the suffix is translated
 * before the ONE reverse lookup runs. The bare `application/cwt` — the single
 * registered CWT media type — names no type, so it recovers nothing.
 */
const coseTokenType = (typ: string | undefined): string | undefined => {
  if (!typ || typ === "application/cwt") return undefined;
  if (!typ.endsWith("+cwt")) return undefined;
  return decodeTokenTypeFromTyp(`${typ.slice(0, -4)}+jwt`, "jwt");
};

/**
 * The ONE wire-header → domain-header translation, for every format on either
 * wire. It was two functions (a JOSE one keyed by base format, a COSE one that
 * also merged the unprotected `kid` in) whose only real difference was how the
 * `tokenType` is recovered from the `typ` — a per-format FACT, not a reason for a
 * second implementation.
 *
 * ⚠ It translates ONE bucket. The caller says which: the protected header and
 * the unprotected header are separate parameters of the result, because a
 * parameter no signature covers must never be readable as though it were signed.
 * The merge that used to happen here is what made the two indistinguishable.
 */
export const domainTokenHeader = (
  wire: WireTokenHeader,
  format: TokenFormatTag,
): DomainTokenHeader => {
  const header = parseTokenHeader(wire);
  const baseFormat = BASE_FORMAT[format];

  header.baseFormat = baseFormat;
  header.tokenType = baseFormat
    ? decodeTokenTypeFromTyp(wire.typ, format)
    : coseTokenType(wire.typ);

  return header;
};

/**
 * The UNPROTECTED bucket as a domain header, or `undefined` when the wire
 * carried none.
 *
 * ⚠ `undefined`, not an empty header. JOSE compact serialisation has no
 * unprotected bucket at all, and its kits report `{}` — which is TRUTHY, so a
 * consumer writing `if (result.unprotectedHeader)` to detect one would get
 * `true` on every JWT and then read `algorithm`, a field `DomainTokenHeader`
 * declares NON-optional, as `undefined`. A header the wire does not have has to
 * be absent, not empty.
 */
export const unprotectedDomainHeader = (
  wire: Partial<WireTokenHeader> | undefined,
  format: TokenFormatTag,
): DomainTokenHeader | undefined =>
  wire && Object.keys(wire).length > 0
    ? domainTokenHeader(wire as WireTokenHeader, format)
    : undefined;
