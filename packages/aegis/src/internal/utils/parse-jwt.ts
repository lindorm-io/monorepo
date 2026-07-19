import type { Dict } from "@lindorm/types";
import { JwtError } from "../../errors/index.js";
import type { ParsedJwt, ParsedJwtHeader } from "../../types/index.js";
import { JwtKit } from "../../classes/JwtKit.js";
import { decodeTokenTypeFromTyp } from "./compute-typ-header.js";
import { extractTokenDelegation } from "./extract-token-delegation.js";
import { parseTokenHeader } from "./token-header.js";
import { parseTokenPayload } from "./jwt-payload.js";
import { validateCrit } from "./validate-crit.js";

/**
 * The UNVERIFIED, keyless DOMAIN parse (Aegis.parse). Splits the wire segments,
 * enforces the structural invariants a JWT must satisfy to be READ as one (typ
 * well-formedness IF PRESENT, crit malformedness), and translates the wire
 * claims to the domain shape. It does NOT check the signature — that is
 * `verifyJwtToDomain`. `parse` remains an Aegis-domain method; the kit has no
 * `parse` (R15).
 */
export const parseJwtToDomain = <C extends Dict = Dict>(token: string): ParsedJwt<C> => {
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

  const payload = parseTokenPayload<C>(decoded.payload);
  const delegation = extractTokenDelegation(decoded.payload as { act?: any });

  return { decoded, delegation, header, payload, token };
};
