import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { JwtKit } from "../../classes/JwtKit.js";
import type { ParsedJwt, VerifyJwtOptions } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { computeTypHeader, extractTypPrefix } from "./compute-typ-header.js";

/**
 * The raw JWT verify namespace (`aegis.jwt.verify`): decode the wire header,
 * resolve the verify key by its `kid` (never a header-embedded key) — with the
 * per-call `key` injection preserved for external keys (RFC 7523
 * `client_secret_jwt`) — then verify the JWT via `JwtKit` and return its NATIVE
 * WIRE shape DIRECTLY (`.payload` wire-keyed `sub`/`exp`, `.header`, `.decoded`,
 * `.token`). NO domain translation, NO named matchers, NO DPoP/actor — the domain
 * result (`.claims`/`.custom`) is `aegis.verify`'s `VerifiedToken`.
 */
export const rawVerifyJwt = async <T extends Dict = Dict>({
  jwt,
  verify = {},
  deps,
}: {
  jwt: string;
  verify?: VerifyJwtOptions;
  deps: AegisDeps;
}): Promise<ParsedJwt<T>> => {
  const decode = JwtKit.decode(jwt);

  const kryptos = await deps.resolveVerifyKey(
    decode.header.kid,
    decode.header.alg as KryptosSigAlgorithm,
    verify.key,
  );

  // The kit asserts the header typ from a bare PREFIX it re-wraps; derive that
  // prefix from the domain `tokenType` (the only wire-relevant knob on the raw
  // surface — named matchers / dpop / actor are the domain surface's job).
  return new JwtKit({
    certBindingMode: deps.certBindingMode,
    clockTolerance: deps.clockTolerance,
    kryptos,
    logger: deps.logger,
  }).verify<T>(jwt, undefined, {
    typ:
      verify.tokenType !== undefined
        ? extractTypPrefix(computeTypHeader(verify.tokenType, "jwt"))
        : undefined,
  });
};
