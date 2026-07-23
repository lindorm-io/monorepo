import type { DomainTokenHeader, WireTokenHeader } from "../../types/index.js";
import { decodeTokenTypeFromTyp } from "./compute-typ-header.js";
import { parseTokenHeader } from "./token-header.js";

/**
 * Translate a decoded JOSE WIRE header into the full-breadth DOMAIN header, with
 * `baseFormat` and the derived `tokenType` stamped. The JOSE twin of
 * `coseDomainHeader`: the raw/kit verify surface speaks the WIRE uniformly
 * (`VerifiedJwtWire.header`/`VerifiedJwsWire.header` are {@link WireTokenHeader}),
 * so the domain verify/parse paths translate the wire header to domain names HERE
 * before assembling a `VerifiedToken`/`ParsedToken` (whose `.header` is
 * domain-named).
 */
export const joseDomainHeader = (
  wire: WireTokenHeader,
  baseFormat: "JWT" | "JWS",
): DomainTokenHeader => {
  const header = parseTokenHeader(wire);
  header.baseFormat = baseFormat;
  header.tokenType = decodeTokenTypeFromTyp(
    wire.typ,
    baseFormat === "JWT" ? "jwt" : "jws",
  );
  return header;
};
