import { getUnixTime } from "@lindorm/date";
import { isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { SignedCwt } from "../../types/index.js";

/**
 * Enrich the wire kit's bare token bytes into the domain `SignedCwt` — the DOMAIN
 * sugar the transform-free `CwtKit`/`CwmKit` no longer computes. The expiry
 * bundle is derived from the wire `exp` (a NumericDate number), the `tokenId`
 * from the wire `cti`. The COSE analogue of `buildSignedJwt`.
 */
export const buildSignedCwt = (
  token: string,
  claims: Dict,
  objectId: string | undefined,
): SignedCwt => {
  const expiresOn =
    typeof claims.exp === "number" && Number.isFinite(claims.exp)
      ? claims.exp
      : undefined;

  return {
    expiresAt: expiresOn !== undefined ? new Date(expiresOn * 1000) : undefined,
    expiresIn: expiresOn !== undefined ? expiresOn - getUnixTime(new Date()) : undefined,
    expiresOn,
    objectId,
    token,
    tokenId: isString(claims.cti) ? claims.cti : undefined,
  };
};
