import { getUnixTime } from "@lindorm/date";
import { isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { SignedToken, TokenFormatTag } from "../../types/index.js";

/**
 * Enrich the wire kit's bare token bytes into the domain `SignedToken` — the
 * DOMAIN sugar the transform-free `CwtKit`/`CwmKit`/`CwsKit` no longer compute.
 * The expiry bundle is derived from the wire `exp` (a NumericDate number), the
 * `tokenId` from the wire `cti`, and `format` records the COSE wire the token is
 * (`cwt`/`cwm`/`cws`). The COSE analogue of `buildSignedJwt`.
 */
export const buildSignedCwt = (
  token: string,
  claims: Dict,
  objectId: string | undefined,
  format: TokenFormatTag,
): SignedToken => {
  const expiresOn =
    typeof claims.exp === "number" && Number.isFinite(claims.exp)
      ? claims.exp
      : undefined;

  return {
    expiresAt: expiresOn !== undefined ? new Date(expiresOn * 1000) : undefined,
    expiresIn: expiresOn !== undefined ? expiresOn - getUnixTime(new Date()) : undefined,
    expiresOn,
    format,
    objectId,
    token,
    tokenId: isString(claims.cti) ? claims.cti : undefined,
  };
};
