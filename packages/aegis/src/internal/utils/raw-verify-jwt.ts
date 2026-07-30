import type { Condition } from "@lindorm/match";
import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { JwtKit } from "../../classes/JwtKit.js";
import type {
  AegisVerifyKey,
  JwtClaimsWire,
  VerifiedStructuredToken,
  VerifyStructuredTokenOptions,
} from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The raw JWT verify namespace (`aegis.jwt.verify`): decode the wire header,
 * resolve the verify key by its `kid` (never a header-embedded key) — with the
 * per-call `key` injection preserved for external keys (RFC 7523
 * `client_secret_jwt`) — then verify the JWT via the transform-free `JwtKit` and
 * return its NATIVE WIRE shape DIRECTLY (`.payload` wire-keyed, `.header`,
 * `.token`). Claim matching is the positional wire `assert` predicate; NO domain
 * translation — the domain result (`.claims`/`.custom`) is `aegis.verify`.
 */
export const rawVerifyJwt = async <C extends Dict = Dict>({
  jwt,
  assert,
  options = {},
  deps,
}: {
  jwt: string;
  assert?: Condition<JwtClaimsWire & C>;
  options?: VerifyStructuredTokenOptions & { key?: AegisVerifyKey };
  deps: AegisDeps;
}): Promise<VerifiedStructuredToken<JwtClaimsWire & C, string>> => {
  // `key` is the aegis-only external-key injection (resolves the kryptos); every
  // other field IS the kit's VerifyStructuredTokenOptions and is forwarded
  // structurally, so a new verify option threads through with no change here.
  const { key, ...verifyOptions } = options;

  const decode = JwtKit.decode(jwt);

  const kryptos = await deps.resolveVerifyKey(
    decode.header.kid,
    decode.header.alg as KryptosSigAlgorithm,
    key,
  );

  return new JwtKit({
    certBindingMode: deps.certBindingMode,
    clockTolerance: deps.clockTolerance,
    kryptos,
    logger: deps.logger,
  }).verify<C>(jwt, assert, verifyOptions);
};
