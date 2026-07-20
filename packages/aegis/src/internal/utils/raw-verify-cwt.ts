import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { CwtKit } from "../../classes/CwtKit.js";
import type { ParsedCwt, VerifyCwtOptions } from "../../types/index.js";
import { verifyCose } from "../cose/verify-cose.js";
import type { AegisDeps } from "./aegis-deps.js";
import { validateCwtClaims } from "./validate-cwt-claims.js";

/**
 * The raw CWT verify namespace (`aegis.cwt.verify`) — mirrors `jwt.verify`:
 * decode, resolve the verify key by kid, verify the COSE_Sign1, then validate
 * the standard claims (exp/nbf/iss/aud) with the JOSE verify matcher.
 */
export const rawVerifyCwt = async <C extends Dict = Dict>({
  token,
  verify = {},
  deps,
}: {
  token: string;
  verify?: VerifyCwtOptions;
  deps: AegisDeps;
}): Promise<ParsedCwt<C>> => {
  const bytes = Buffer.from(token, "base64url");
  const decoded = CwtKit.decode(bytes);

  const kryptos = await deps.resolveVerifyKey(
    decoded.kid,
    decoded.algorithm as KryptosSigAlgorithm,
    verify.key,
  );

  const { claims, wire } = verifyCose({
    kryptos,
    logger: deps.logger,
    token: bytes,
    clockTolerance: deps.clockTolerance,
  });

  validateCwtClaims(wire, kryptos.algorithm, verify, deps.clockTolerance);

  return {
    claims: claims as C,
    header: { alg: decoded.algorithm, kid: decoded.kid, typ: decoded.typ },
    token,
  };
};
