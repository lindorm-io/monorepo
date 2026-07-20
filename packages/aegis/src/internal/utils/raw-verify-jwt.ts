import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { JwtKit } from "../../classes/JwtKit.js";
import type { ParsedJwt, VerifyJwtOptions } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { verifyJwtToDomain } from "./verify-jwt.js";

/**
 * The raw JWT verify namespace (`aegis.jwt.verify`): decode the wire header,
 * resolve the verify key by its `kid` (never a header-embedded key), then verify
 * the JWT and translate it to the domain `ParsedJwt`.
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

  return verifyJwtToDomain(
    new JwtKit({
      certBindingMode: deps.certBindingMode,
      clockTolerance: deps.clockTolerance,
      kryptos,
      logger: deps.logger,
    }),
    jwt,
    verify,
    {
      clockTolerance: deps.clockTolerance,
      dpopMaxSkew: deps.dpopMaxSkew,
    },
  );
};
