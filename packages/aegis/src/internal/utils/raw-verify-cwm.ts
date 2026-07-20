import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import { CwmKit } from "../../classes/CwmKit.js";
import type { CwtWireClaims, ParsedCwt, VerifyCwtOptions } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The raw CWM verify namespace (`aegis.cwm.verify`) — the COSE_Mac0 (symmetric)
 * twin of `aegis.cwt.verify`: decode the kid, resolve the verify key, then verify
 * the COSE_Mac0 via `CwmKit` and return its NATIVE WIRE payload (COSE-name-keyed,
 * temporal claims as `Date`s). NO domain translation. An asymmetric key throws
 * via the kit gate (that is `aegis.cwt.verify`).
 */
export const rawVerifyCwm = async <C extends CwtWireClaims = CwtWireClaims>({
  token,
  verify = {},
  deps,
}: {
  token: string;
  verify?: VerifyCwtOptions;
  deps: AegisDeps;
}): Promise<ParsedCwt<C>> => {
  const bytes = Buffer.from(token, "base64url");
  const decoded = CwmKit.decode(bytes);

  const kryptos = await deps.resolveVerifyKey(
    decoded.kid,
    decoded.algorithm as KryptosSigAlgorithm,
    verify.key,
  );

  const { claims } = new CwmKit({
    kryptos,
    logger: deps.logger,
    clockTolerance: deps.clockTolerance,
  }).verify<C>(bytes);

  return {
    header: { alg: decoded.algorithm, kid: decoded.kid, typ: decoded.typ },
    payload: claims,
    token,
  };
};
