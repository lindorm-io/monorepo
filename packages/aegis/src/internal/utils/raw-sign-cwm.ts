import { CwmKit } from "../../classes/CwmKit.js";
import type { CwtWireClaims, SignCwtOptions, SignedCwt } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { buildSignedCwt } from "./cwt-payload.js";

/**
 * The raw CWM sign namespace (`aegis.cwm.sign`) — the COSE_Mac0 (symmetric) twin
 * of `aegis.cwt.sign`. Identical transform-free wire assembly; only the integrity
 * structure differs (a MAC, not a signature). A CWM shares the CWT media type
 * (`application/cwt` / `+cwt`) — the STRUCTURE (Mac0 vs Sign1) is what tells `cwm`
 * apart from `cwt` (D6). A symmetric key is required; an asymmetric one throws via
 * the kit gate (that is `aegis.cwt.sign`).
 */
export const rawSignCwm = async <C extends CwtWireClaims = CwtWireClaims>({
  claims,
  options = {},
  deps,
}: {
  claims: C;
  options?: SignCwtOptions;
  deps: AegisDeps;
}): Promise<SignedCwt> => {
  const kryptos = await deps.resolveSignKey({ key: options.key });

  const token = new CwmKit({ kryptos, logger: deps.logger }).sign<C>(claims, {
    typ: options.typ,
    proprietary: options.proprietary,
    omit: options.omit,
  });

  return buildSignedCwt(token.toString("base64url"), claims, options.objectId);
};
