import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { Dict, Predicate } from "@lindorm/types";
import { CwtKit } from "../../classes/CwtKit.js";
import { decodeCwt } from "../cose/cwt-token.js";
import type {
  AegisVerifyKey,
  CwtClaimsWire,
  VerifiedStructuredToken,
  VerifyStructuredTokenOptions,
} from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The raw CWT verify namespace (`aegis.cwt.verify`) — mirrors `jwt.verify`:
 * decode the kid, resolve the verify key by kid, then verify the COSE_Sign1
 * (asymmetric) via `CwtKit` and return its NATIVE WIRE result DIRECTLY
 * (COSE-name-keyed `payload`, wire `header`, native `Buffer` `token`). Claim
 * matching is the positional wire `assert` predicate; NO domain translation. The
 * symmetric COSE_Mac0 twin is `cwm`.
 */
export const rawVerifyCwt = async <C extends Dict = Dict>({
  token,
  assert,
  options = {},
  deps,
}: {
  token: string;
  assert?: Predicate<CwtClaimsWire & C>;
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

  return new CwtKit({
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
