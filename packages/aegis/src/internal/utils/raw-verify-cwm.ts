import type { Condition } from "@lindorm/match";
import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { CwmKit } from "../../classes/CwmKit.js";
import { decodeCwt } from "../cose/cwt-token.js";
import type {
  AegisVerifyKey,
  CwtClaimsWire,
  VerifiedStructuredToken,
  VerifyStructuredTokenOptions,
} from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The raw CWM verify namespace (`aegis.cwm.verify`) — the COSE_Mac0 (symmetric)
 * twin of `aegis.cwt.verify`: decode the kid, resolve the verify key, then verify
 * the COSE_Mac0 via `CwmKit` and return its NATIVE WIRE result DIRECTLY
 * (COSE-name-keyed `payload`, wire `header`, native `Buffer` `token`). Claim
 * matching is the positional wire `assert` predicate; NO domain translation. An
 * asymmetric key throws via the kit gate (that is `aegis.cwt.verify`).
 */
export const rawVerifyCwm = async <C extends Dict = Dict>({
  token,
  assert,
  options = {},
  deps,
}: {
  token: string;
  assert?: Condition<CwtClaimsWire & C>;
  options?: VerifyStructuredTokenOptions & { key?: AegisVerifyKey };
  deps: AegisDeps;
}): Promise<VerifiedStructuredToken<CwtClaimsWire & C, Buffer>> => {
  const bytes = Buffer.from(token, "base64url");
  const decoded = decodeCwt(bytes);

  const kryptos = await deps.resolveVerifyKey(
    decoded.kid,
    decoded.algorithm as KryptosSigAlgorithm,
    options.key,
  );

  return new CwmKit({
    kryptos,
    logger: deps.logger,
    clockTolerance: deps.clockTolerance,
  }).verify<C>(bytes, assert, {
    clockTolerance: options.clockTolerance,
    currentDate: options.currentDate,
    maxTokenAge: options.maxTokenAge,
    tokenType: options.tokenType,
  });
};
