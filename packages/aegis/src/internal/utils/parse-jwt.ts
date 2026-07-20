import type { Dict } from "@lindorm/types";
import { JwtKit } from "../../classes/JwtKit.js";
import { JwtError } from "../../errors/index.js";
import type { ParsedJwtHeader, VerifiedToken } from "../../types/index.js";
import { decodeTokenTypeFromTyp } from "./compute-typ-header.js";
import { extractTokenDelegation } from "./extract-token-delegation.js";
import { buildDomainClaims } from "./jwt-payload.js";
import { parseTokenHeader } from "./token-header.js";
import { validateCrit } from "./validate-crit.js";

/**
 * The UNVERIFIED, keyless DOMAIN parse of a JWT (`aegis.parse`). Splits the wire
 * segments, enforces the structural invariants a JWT must satisfy to be READ as
 * one (typ well-formedness IF PRESENT, crit malformedness), and assembles the
 * unified {@link VerifiedToken} (domain `claims`/`custom`/`profile` buckets + the
 * untranslated `wire.payload`). It does NOT check the signature — that is
 * `verifyJwtToken`. A parseable JWT is unencrypted, so sensitive claims are
 * suppressed (§13.3).
 */
export const parseJwtToDomain = <C extends Dict = Dict>(
  token: string,
): VerifiedToken<C> => {
  const decoded = JwtKit.decode<C>(token);

  const typ = decoded.header.typ;
  if (typ !== undefined && typ !== "JWT" && !typ.endsWith("+jwt")) {
    throw new JwtError("Invalid token", {
      code: "jwt_invalid_typ",
      data: { typ },
      title: "JWT Invalid Typ",
      details:
        "Header typ is present but is not JWT or a <type>+jwt media type, so the token cannot be parsed as a JWT.",
    });
  }

  const critError = validateCrit(decoded.header);
  if (critError) {
    throw new JwtError(`Invalid crit header: ${critError}`, {
      code: "jwt_invalid_crit",
      data: { crit: decoded.header.crit },
      title: "JWT Invalid Crit",
      details:
        "The crit header is malformed; it must be a non-empty array of strings naming extension parameters present in the header.",
    });
  }

  const header = parseTokenHeader<ParsedJwtHeader>(decoded.header);
  header.tokenType = decodeTokenTypeFromTyp(typ, "jwt");
  header.baseFormat = "JWT";

  const { claims, custom, profile, sensitive } = buildDomainClaims<C>(
    decoded.payload,
    false,
  );
  const delegation = extractTokenDelegation(decoded.payload as { act?: any });

  return {
    format: "jwt",
    header,
    claims,
    custom,
    profile,
    sensitive,
    delegation,
    wire: { payload: decoded.payload },
    token,
  };
};
