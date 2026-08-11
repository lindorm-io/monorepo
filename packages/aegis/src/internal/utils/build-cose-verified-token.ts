import type { Dict } from "@lindorm/types";
import type {
  DomainTokenHeader,
  TokenDelegation,
  VerifiedToken,
  WireTokenHeader,
} from "../../types/index.js";
import { Tag } from "../cose/cbor.js";
import type { CwtDecoded } from "../cose/cwt-token.js";
import { COSE_TAG } from "../cose/structures.js";
import { coseToBuckets } from "../claims/resolve-domain-buckets.js";
import { decodeTokenTypeFromTyp } from "./compute-typ-header.js";
import { extractTokenDelegation } from "./extract-token-delegation.js";
import { parseTokenHeader } from "./token-header.js";

// The COSE structure tag (Sign1 / Mac0) decides `cwt` vs `cwm` on READ (D6): a
// COSE_Sign1 (tag 18, asymmetric) is a `cwt`, a COSE_Mac0 (tag 17, symmetric) a
// `cwm`. `decoded.cose` is the inner COSE Tag (the outer CWT tag 61 already
// stripped by `decodeCwt`).
const coseFormatOf = (cose: unknown): "cwt" | "cwm" =>
  cose instanceof Tag && cose.tag === COSE_TAG.mac0 ? "cwm" : "cwt";

// The COSE tokenType from its `typ`: COSE uses `+cwt` where JOSE uses `+jwt`, so
// translate the suffix before reusing the JOSE reverse lookup. The bare
// `application/cwt` (the one registered CWT type) carries no recoverable type.
const coseTokenType = (typ: string | undefined): string | undefined => {
  if (!typ || typ === "application/cwt") return undefined;
  if (typ.endsWith("+cwt")) {
    return decodeTokenTypeFromTyp(`${typ.slice(0, -4)}+jwt`, "jwt");
  }
  return undefined;
};

/**
 * Build the full-breadth DOMAIN header for a COSE token from its INTEGRITY-
 * PROTECTED wire header. Shared by the CWT/CWM claims path and the opaque CWS
 * path.
 *
 * ⚠ It used to be handed an `{ alg, kid, typ }` TRIPLE, and everything else the
 * issuer had signed was dropped on the way out: a protected `oid` reached the
 * wire, survived verification, and then existed nowhere a caller could see it.
 * The whole protected bucket is passed through the registry now.
 *
 * `kid` is the ONE value taken from the unprotected bucket, and only when the
 * protected one carries none. That is not a loophole: RFC 9052 §3.1 makes `kid`
 * an advisory routing hint, aegis emits it unprotected on every COSE token it
 * signs, and the key it names has already been superseded by the key the
 * signature actually verified against. Nothing else from that bucket is
 * admitted, because nothing else there is covered by anything.
 */
export const coseDomainHeader = (
  protectedHeader: WireTokenHeader,
  unprotectedKid?: string,
): DomainTokenHeader => {
  const header = parseTokenHeader({
    kid: unprotectedKid,
    ...protectedHeader,
  } as WireTokenHeader);

  // A COSE token is not a JOSE family member, so `baseFormat` stays undefined
  // (the `format` discriminant tells JOSE from COSE); the tokenType is derived
  // from the COSE `typ`.
  header.baseFormat = undefined;
  header.tokenType = coseTokenType(protectedHeader.typ);

  return header;
};

/**
 * Assemble the unified {@link VerifiedToken} for a verified COSE claims token
 * (CWT / CWM) from the wire claims + decoded header. Splits the wire into the
 * domain `claims`/`custom`/`profile`/`sensitive` buckets, reports `cwt` vs `cwm`
 * from the COSE structure tag, and honours the §13.3 sensitive gate (surfaced
 * only when the outer COSE was encrypted).
 */
export const buildCoseVerifiedToken = ({
  wire,
  decoded,
  protectedHeader,
  token,
  encrypted,
}: {
  wire: Dict;
  decoded: CwtDecoded;
  /** The VERIFIED protected header — the only bucket the signature/MAC covers. */
  protectedHeader: WireTokenHeader;
  token: string;
  encrypted: boolean;
  // `delegation` is narrowed to REQUIRED on the way out: a claims-bearing COSE
  // token always has an act summary (an absent `act` yields `isDelegated:
  // false`, not `undefined`), and the verify policy needs it non-optional.
}): VerifiedToken & { delegation: TokenDelegation } => {
  // The same shared resolution the JOSE read path and `Aegis.toDomain` run —
  // one step, so the two doors onto the registry cannot resolve different
  // surfaces again.
  const { claims, custom, profile, sensitive } = coseToBuckets(wire);

  // The act-chain summary, which this used to omit entirely — so a COSE result
  // reported `delegation.isDelegated: false` for a token that WAS delegated, on
  // a field `VerifiedToken` documents as uniform across all six formats.
  const delegation = extractTokenDelegation(wire as { act?: any });

  return {
    format: coseFormatOf(decoded.cose),
    header: coseDomainHeader(protectedHeader, decoded.kid),
    claims,
    custom,
    profile,
    delegation,
    sensitive: encrypted ? sensitive : undefined,
    wire: { payload: wire },
    token,
  };
};
