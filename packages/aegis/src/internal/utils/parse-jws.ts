import { B64 } from "@lindorm/b64";
import type { Dict } from "@lindorm/types";
import { JwsKit } from "../../classes/JwsKit.js";
import { JwsError } from "../../errors/index.js";
import { B64U } from "../constants/format.js";
import type { ParsedToken } from "../../types/index.js";
import { joseDomainHeader } from "./jose-domain-header.js";
import { validateCrit } from "./validate-crit.js";

/**
 * The UNVERIFIED, keyless DOMAIN parse of a JWS (`aegis.parse`). Splits the wire
 * segments, enforces the structural invariants a JWS must satisfy to be READ as
 * one (typ well-formedness IF PRESENT, crit malformedness), and assembles the
 * unified {@link ParsedToken} with the DOMAIN-named header + the opaque `raw`
 * payload (a JWS carries no claims layer). It does NOT check the signature — the
 * result is UNVERIFIED. The JWS twin of `parseJwtToDomain`; the domain parse is
 * an Aegis concept, so it lives HERE rather than as a kit `parse` method.
 */
export const parseJwsToDomain = <C extends Dict = Dict>(
  token: string,
): ParsedToken<C> => {
  const decoded = JwsKit.decodeSegments(token);

  const typ = decoded.header.typ;
  if (typ !== undefined && typ !== "JWS" && typ !== "JOSE" && !typ.endsWith("+jws")) {
    throw new JwsError("Invalid token", {
      code: "jws_invalid_typ",
      data: { typ },
      title: "JWS Invalid Typ",
      details: "Header typ must be JWS, JOSE, a <type>+jws media type, or undefined.",
    });
  }

  const critError = validateCrit(decoded.header);
  if (critError) {
    throw new JwsError(`Invalid crit header: ${critError}`, {
      code: "jws_invalid_crit",
      data: { crit: decoded.header.crit },
      title: "JWS Invalid Crit",
      details:
        "The crit header is malformed; it must be a non-empty array of strings naming extension parameters present in the header.",
    });
  }

  const header = joseDomainHeader(decoded.header, "JWS");

  // Keyless UNVERIFIED read: the opaque payload as `Buffer | string` (a
  // `text/plain` cty surfaces the string, everything else the raw bytes). A
  // claims-bearing token is a JWT, so no JSON reconstruction happens here.
  const bytes = B64.toBuffer(decoded.payload, B64U);
  const raw = decoded.header.cty === "text/plain" ? bytes.toString("utf8") : bytes;

  return {
    format: "jws",
    header,
    claims: {},
    custom: {} as C,
    raw,
    token,
  };
};
