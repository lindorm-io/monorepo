import { getUnixTime } from "@lindorm/date";
import { isFinite, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { SignedToken, TokenFormat } from "../../types/index.js";
import { claimByDomain, type NameSelector } from "../claims/claims-registry.js";

/**
 * Enrich a wire kit's bare token into the domain {@link SignedToken}. ONE
 * function for both wires: the token id is read under `jti` or `cti`, which is a
 * REGISTRY fact and not a reason for a second implementation.
 *
 * Both claim keys are resolved through the claim registry via the same
 * {@link NameSelector} the claim translator takes, so neither wire name is
 * written down here: `expiresAt` agrees on both wires, `tokenId` diverges, and
 * the registry is what knows that.
 */
export const buildSignedToken = (
  token: string,
  claims: Dict,
  objectId: string | undefined,
  // The SIGNED token's own kind. {@link TokenFormat} excludes the encrypting
  // outers because no caller has one to pass: every call site is a signer.
  format: TokenFormat,
  nameOf: NameSelector,
): SignedToken => {
  const wireName = (domain: string): string => {
    const spec = claimByDomain(domain);

    if (!spec) {
      throw new Error(`No claim registry entry for "${domain}"`);
    }

    return nameOf(spec);
  };

  const exp = claims[wireName("expiresAt")];
  const expiresOn = isFinite(exp) ? exp : undefined;

  const tokenId = claims[wireName("tokenId")];

  return {
    expiresAt: expiresOn !== undefined ? new Date(expiresOn * 1000) : undefined,
    expiresIn: expiresOn !== undefined ? expiresOn - getUnixTime(new Date()) : undefined,
    expiresOn,
    format,
    objectId,
    token,
    tokenId: isString(tokenId) ? tokenId : undefined,
  };
};
