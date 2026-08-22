import type {
  BaseTokenFormat,
  DomainTokenHeader,
  CoseHeaderBuckets,
  TokenFormatTag,
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
 * ⛔ IT TAKES THE TWO TYPED BUCKETS ONLY, by `Pick`, never a kit result's whole
 * {@link CoseHeaderBuckets}. This is the wire → domain crossing, and an
 * unregistered wire parameter has no domain name by definition — the domain
 * surface exists so a caller never learns the wire's vocabulary. `parseTokenHeader`
 * below drops one anyway (it keeps only what `headerByJose` answers for), so this
 * is the second of two independent gates; pinned in
 * `internal/header/custom-header-params.test.ts`.
 *
 * ⚠ THE PARAMETER IS THE COSE PAIR (RFC 9052 §3), and the JOSE read arms in
 * `internal/wire/jose-token-wire.ts` adapt into it by stating
 * `unprotectedHeader: {}`: compact serialisation has no second bucket, so there is
 * no shared two-bucket type to take instead.
 *
 * It merges the two canonically ({@link mergeHeaderBuckets}): the unprotected
 * bucket filtered to what the header registry permits there, then overwritten by
 * the protected one.
 *
 * `decodeTokenTypeFromTyp` is handed the format the token actually is, so its own
 * per-format tables recover a COSE spelling such as `application/at+cwe`.
 */
export const domainTokenHeader = (
  buckets: Pick<CoseHeaderBuckets, "protectedHeader" | "unprotectedHeader">,
  format: TokenFormatTag,
): DomainTokenHeader => {
  const wire = mergeHeaderBuckets(buckets);
  const header = parseTokenHeader(wire);

  header.baseFormat = BASE_FORMAT[format];
  header.tokenType = decodeTokenTypeFromTyp(wire.typ, format);

  return header;
};
