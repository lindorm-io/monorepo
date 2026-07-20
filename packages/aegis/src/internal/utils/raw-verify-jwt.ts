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
  encrypted = false,
}: {
  jwt: string;
  verify?: VerifyJwtOptions;
  deps: AegisDeps;
  // Set by the caller (verifyToken) when this JWT is the inner token of a
  // decrypted JWE — the outer format was encrypted. A directly-verified JWT
  // (`aegis.jwt.verify`) is unencrypted, so sensitive claims are suppressed.
  encrypted?: boolean;
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
    encrypted,
  );
};
