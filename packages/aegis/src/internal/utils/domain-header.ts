import type {
  BaseTokenFormat,
  DomainTokenHeader,
  TokenFormatTag,
  WireHeaderBuckets,
} from "../../types/index.js";
import { mergeHeaderBuckets } from "../header/merge-header-buckets.js";
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
 * The ONE wire-header → domain-header translation, for every format on either
 * wire, and the ONE producer of the single `header` the domain results report.
 *
 * ⛔ IT TAKES THE TWO TYPED BUCKETS ONLY, by `Pick`, never the whole
 * {@link WireHeaderBuckets}. This is the wire → domain crossing, and an
 * unregistered wire parameter has no domain name by definition — the domain
 * surface exists so a caller never learns the wire's vocabulary. `parseTokenHeader`
 * below drops one anyway (it keeps only what `headerByJose` answers for), so this
 * is the second of two independent gates; pinned in
 * `internal/header/custom-header-params.test.ts`.
 *
 * It takes BOTH buckets and merges them canonically ({@link mergeHeaderBuckets}):
 * the unprotected bucket filtered to what the header registry permits there, then
 * overwritten by the protected one. The KIT tier keeps the two apart — that is
 * the COSE wire and it is correct — but the domain tier speaks neither wire's
 * vocabulary, and `protectedHeader`/`unprotectedHeader` is a COSE STRUCTURAL fact:
 * a compact JOSE token has one header and no such bucket, so the split left every
 * JOSE result carrying a field that could never be populated.
 *
 * The `tokenType` recovery is now ONE call. It was two — a JOSE branch and a COSE
 * one that rewrote `+cwt` to `+jwt` so it could ask the JOSE question — which is
 * why `application/at+cwe` recovered nothing: the rewrite only knew the one
 * suffix. `decodeTokenTypeFromTyp` is already per-format (its own `FORMAT_SUFFIX`
 * and `FORMAT_FALLBACK` tables carry every COSE spelling), so handing it the
 * format the token actually is answers for all seven.
 */
export const domainTokenHeader = (
  buckets: Pick<WireHeaderBuckets, "protectedHeader" | "unprotectedHeader">,
  format: TokenFormatTag,
): DomainTokenHeader => {
  const wire = mergeHeaderBuckets(buckets);
  const header = parseTokenHeader(wire);

  header.baseFormat = BASE_FORMAT[format];
  header.tokenType = decodeTokenTypeFromTyp(wire.typ, format);

  return header;
};
