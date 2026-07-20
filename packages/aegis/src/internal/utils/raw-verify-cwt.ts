import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { Predicate } from "@lindorm/types";
import { CwtKit } from "../../classes/CwtKit.js";
import type { CwtWireClaims, ParsedCwt, VerifyCwtOptions } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The raw CWT verify namespace (`aegis.cwt.verify`) — mirrors `jwt.verify`:
 * decode the kid, resolve the verify key by kid, then verify the COSE_Sign1
 * (asymmetric) via `CwtKit` and return its NATIVE WIRE payload (COSE-name-keyed
 * `cti`/`exp`, temporal claims as `Date`s). Claim matching is the positional wire
 * `assert` predicate; NO domain translation, NO named matchers — those live on
 * the Aegis `verify` domain surface. The symmetric COSE_Mac0 twin is `cwm`.
 */
export const rawVerifyCwt = async <C extends CwtWireClaims = CwtWireClaims>({
  token,
  assert,
  options = {},
  deps,
}: {
  token: string;
  assert?: Predicate<C>;
  options?: VerifyCwtOptions;
  deps: AegisDeps;
}): Promise<ParsedCwt<C>> => {
  const bytes = Buffer.from(token, "base64url");
  const decoded = CwtKit.decode(bytes);

  const kryptos = await deps.resolveVerifyKey(
    decoded.kid,
    decoded.algorithm as KryptosSigAlgorithm,
    options.key,
  );

  const { claims } = new CwtKit({
    kryptos,
    logger: deps.logger,
    clockTolerance: deps.clockTolerance,
  }).verify<C>(bytes, assert, {
    clockTolerance: options.clockTolerance,
    typ: options.typ,
  });

  return {
    header: { alg: decoded.algorithm, kid: decoded.kid, typ: decoded.typ },
    payload: claims,
    token,
  };
};
