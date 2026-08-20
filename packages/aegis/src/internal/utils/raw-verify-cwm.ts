import type { Condition } from "@lindorm/match";
import { isString } from "@lindorm/is";
import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { CwmKit } from "../../classes/CwmKit.js";
import { decodeCwt } from "../cose/decode-cwt.js";
import type {
  AegisVerifyKey,
  CwtClaimsWire,
  CoseVerifiedStructuredToken,
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
}): Promise<CoseVerifiedStructuredToken<CwtClaimsWire & C>> => {
  // `key` is the aegis-only external-key injection (resolves the kryptos); every
  // other field IS the kit's VerifyStructuredTokenOptions and is forwarded
  // structurally, so a new verify option threads through with no change here.
  const { key, ...verifyOptions } = options;

  const bytes = Buffer.from(token, "base64url");
  const decoded = decodeCwt(bytes);

  // Scoped by the token's own UNVERIFIED `iss`, as in `rawVerifyCwt` — a
  // COSE_Mac0 payload is cleartext CBOR too. Narrowing only, no fallback.
  const kryptos = await deps.resolveVerifyKey({
    id: decoded.kid,
    algorithm: decoded.algorithm as KryptosSigAlgorithm,
    issuer: isString(decoded.payload?.iss) ? decoded.payload.iss : undefined,
    verify: key,
  });

  return new CwmKit({
    certBindingMode: deps.certBindingMode,
    kryptos,
    logger: deps.logger,
    clockTolerance: deps.clockTolerance,
  }).verify<C>(bytes, assert, verifyOptions);
};
