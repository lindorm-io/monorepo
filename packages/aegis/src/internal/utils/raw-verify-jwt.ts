import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { Predicate } from "@lindorm/types";
import { JwtKit } from "../../classes/JwtKit.js";
import type {
  AegisVerifyKey,
  JwtWireClaims,
  ParsedJwt,
  VerifyJwtWireOptions,
} from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The raw JWT verify namespace (`aegis.jwt.verify`): decode the wire header,
 * resolve the verify key by its `kid` (never a header-embedded key) — with the
 * per-call `key` injection preserved for external keys (RFC 7523
 * `client_secret_jwt`) — then verify the JWT via the transform-free `JwtKit` and
 * return its NATIVE WIRE shape DIRECTLY (`.payload` wire-keyed `sub`/`exp`,
 * `.header`, `.decoded`, `.token`). Claim matching is the positional wire
 * `assert` predicate; NO domain translation, NO named matchers, NO DPoP/actor —
 * the domain result (`.claims`/`.custom`) is `aegis.verify`'s `VerifiedToken`.
 */
export const rawVerifyJwt = async <C extends JwtWireClaims = JwtWireClaims>({
  jwt,
  assert,
  options = {},
  deps,
}: {
  jwt: string;
  assert?: Predicate<C>;
  options?: VerifyJwtWireOptions & { key?: AegisVerifyKey };
  deps: AegisDeps;
}): Promise<ParsedJwt<C>> => {
  const decode = JwtKit.decodeSegments(jwt);

  const kryptos = await deps.resolveVerifyKey(
    decode.header.kid,
    decode.header.alg as KryptosSigAlgorithm,
    options.key,
  );

  return new JwtKit({
    certBindingMode: deps.certBindingMode,
    clockTolerance: deps.clockTolerance,
    kryptos,
    logger: deps.logger,
  }).verify<C>(jwt, assert, {
    certBindingMode: options.certBindingMode,
    clockTolerance: options.clockTolerance,
    typ: options.typ,
  });
};
