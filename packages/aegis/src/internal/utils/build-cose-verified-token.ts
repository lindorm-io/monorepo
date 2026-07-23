import type { Dict } from "@lindorm/types";
import type {
  VerifiedToken,
  VerifiedTokenHeader,
  WireTokenHeader,
} from "../../types/index.js";
import { Tag } from "../cose/cbor.js";
import type { CwtDecoded } from "../cose/cwt-token.js";
import { COSE_TAG } from "../cose/structures.js";
import { coseToDomain } from "../claims/translate.js";
import { decodeTokenTypeFromTyp } from "./compute-typ-header.js";
import type { DomainClaims } from "./extract-claims.js";
import { extractAegisProfile } from "./extract-aegis-profile.js";
import { extractSensitiveClaims } from "./extract-sensitive-claims.js";
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
 * Build the full-breadth DOMAIN header for a COSE token from its wire alg/kid/typ
 * triple (the COSE protected/unprotected map values). Shared by the CWT/CWM
 * claims path and the opaque CWS path.
 */
export const coseDomainHeader = (triple: {
  alg?: string | undefined;
  kid?: string | undefined;
  typ?: string | undefined;
}): VerifiedTokenHeader => {
  const header = parseTokenHeader({
    alg: triple.alg,
    kid: triple.kid,
    typ: triple.typ,
  } as WireTokenHeader);

  // A COSE token is not a JOSE family member, so `baseFormat` stays undefined
  // (the `format` discriminant tells JOSE from COSE); the tokenType is derived
  // from the COSE `typ`.
  header.baseFormat = undefined;
  header.tokenType = coseTokenType(triple.typ);

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
  token,
  encrypted,
}: {
  wire: Dict;
  decoded: CwtDecoded;
  token: string;
  encrypted: boolean;
}): VerifiedToken => {
  const { claims: domainAll, custom } = coseToDomain(wire);
  const { profile, rest: afterProfile } = extractAegisProfile(domainAll);
  const { sensitive, rest: claims } = extractSensitiveClaims(afterProfile);

  return {
    format: coseFormatOf(decoded.cose),
    header: coseDomainHeader({
      alg: decoded.algorithm,
      kid: decoded.kid,
      typ: decoded.typ,
    }),
    claims: claims as DomainClaims,
    custom,
    profile,
    sensitive: encrypted ? sensitive : undefined,
    wire: { payload: wire },
    token,
  };
};
