import type { Dict } from "@lindorm/types";
import type { SignedJwt, SignJwtContent, SignJwtOptions } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { assembleJwtWireClaims } from "./jwt-payload.js";
import { signJwtWire } from "./sign-jwt-wire.js";

/**
 * The raw JWT sign namespace (`aegis.jwt.sign`): resolve the signing key, map the
 * standard-claim content to the JOSE wire claims, and sign the JWT. The generic
 * counterpart of the profiled mint path (`mintToken`), minus the profile floor
 * and auto-injection.
 */
export const rawSignJwt = async <T extends Dict = Dict>({
  content,
  options = {},
  deps,
}: {
  content: SignJwtContent<T>;
  options?: SignJwtOptions;
  deps: AegisDeps;
}): Promise<SignedJwt> => {
  const kryptos = await deps.resolveSignKey(options);

  const claims = assembleJwtWireClaims<T>(
    { algorithm: kryptos.algorithm },
    content,
    options,
  );

  return signJwtWire({
    kryptos,
    wireClaims: claims,
    content,
    options,
    certBindingMode: deps.certBindingMode,
    clockTolerance: deps.clockTolerance,
    logger: deps.logger,
  });
};
