import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { CwtKit } from "../../classes/CwtKit.js";
import type { ParsedCws, VerifyCwsOptions } from "../../types/index.js";
import { verifyCose } from "../cose/verify-cose.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The raw CWS verify namespace (`aegis.cws.verify`) — mirrors `jws.verify`:
 * decode the kid, resolve the verify key, verify the COSE_Sign1.
 */
export const rawVerifyCws = async <T extends Dict = Dict>({
  token,
  options = {},
  deps,
}: {
  token: string;
  options?: VerifyCwsOptions;
  deps: AegisDeps;
}): Promise<ParsedCws<T>> => {
  const bytes = Buffer.from(token, "base64url");
  const decoded = CwtKit.decode(bytes);

  const kryptos = await deps.resolveVerifyKey(
    decoded.kid,
    decoded.algorithm as KryptosSigAlgorithm,
    options.key,
  );

  const { claims } = verifyCose({
    kryptos,
    logger: deps.logger,
    token: bytes,
    clockTolerance: deps.clockTolerance,
  });

  return {
    claims: claims as T,
    header: { alg: decoded.algorithm, kid: decoded.kid, typ: decoded.typ },
    token,
  };
};
