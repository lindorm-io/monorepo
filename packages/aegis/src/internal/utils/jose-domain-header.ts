import type {
  BaseTokenFormat,
  DomainTokenHeader,
  WireTokenHeader,
} from "../../types/index.js";
import { type KitFormat, decodeTokenTypeFromTyp } from "./compute-typ-header.js";
import { parseTokenHeader } from "./token-header.js";

const KIT_FORMAT: Record<BaseTokenFormat, KitFormat> = {
  JWT: "jwt",
  JWS: "jws",
  JWE: "jwe",
};

/**
 * Translate a decoded JOSE WIRE header into the full-breadth DOMAIN header, with
 * `baseFormat` and the derived `tokenType` stamped. The JOSE twin of
 * `coseDomainHeader`: the raw/kit verify surface speaks the WIRE uniformly
 * (`VerifiedJwtWire.header`/`VerifiedJwsWire.header` are {@link WireTokenHeader}),
 * so the domain verify/parse/decrypt paths translate the wire header to domain
 * names HERE before assembling a `VerifiedToken`/`ParsedToken`/`DecryptedToken`
 * (whose `.header` is domain-named). A JWE (`baseFormat: "JWE"`) is a JOSE member
 * too, so `aegis.decrypt` and the keyless `parse` route its header through here —
 * that is what populates `header.tokenType` on a decrypted JWE.
 */
export const joseDomainHeader = (
  wire: WireTokenHeader,
  baseFormat: BaseTokenFormat,
): DomainTokenHeader => {
  const header = parseTokenHeader(wire);
  header.baseFormat = baseFormat;
  header.tokenType = decodeTokenTypeFromTyp(wire.typ, KIT_FORMAT[baseFormat]);
  return header;
};
