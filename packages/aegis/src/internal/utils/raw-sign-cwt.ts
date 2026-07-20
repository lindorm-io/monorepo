import { CwtKit } from "../../classes/CwtKit.js";
import type { CwtWireClaims, SignCwtOptions, SignedCwt } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { buildSignedCwt } from "./cwt-payload.js";

/**
 * The raw CWT sign namespace (`aegis.cwt.sign`) — the generic-CWT mirror of the
 * generic `jwt.sign`. Resolve the signing key, then serialize the ALREADY-WIRE
 * `CwtWireClaims` (COSE-name-keyed: `iss`/`sub`/`exp`/`cti`) verbatim via the
 * transform-free `CwtKit` (R18) — no domain translation, no envelope
 * auto-injection. The domain sign path is `aegis.mint`.
 *
 * The raw `cwt` namespace is COSE_Sign1 (asymmetric); a symmetric key throws via
 * the kit gate — the symmetric COSE_Mac0 twin is the `cwm` namespace.
 */
export const rawSignCwt = async <C extends CwtWireClaims = CwtWireClaims>({
  claims,
  options = {},
  deps,
}: {
  claims: C;
  options?: SignCwtOptions;
  deps: AegisDeps;
}): Promise<SignedCwt> => {
  const kryptos = await deps.resolveSignKey({ key: options.key });

  const token = new CwtKit({ kryptos, logger: deps.logger }).sign<C>(claims, {
    typ: options.typ,
    proprietary: options.proprietary,
    omit: options.omit,
  });

  return buildSignedCwt(token.toString("base64url"), claims, options.objectId);
};
