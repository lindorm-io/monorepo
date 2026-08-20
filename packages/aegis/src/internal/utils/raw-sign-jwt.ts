import type { Dict } from "@lindorm/types";
import type {
  AegisSignKey,
  JwtClaimsWire,
  JoseSignStructuredTokenOptions,
  SignedToken,
} from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { joseName } from "../claims/claims-registry.js";
import { buildSignedToken } from "./build-signed-token.js";
import { signJwt } from "./sign-jwt.js";

/**
 * The raw JWT sign namespace (`aegis.jwt.sign`): resolve the signing key, then
 * serialize the ALREADY-WIRE `JwtClaimsWire` verbatim via the transform-free
 * `JwtKit` — no domain translation, no envelope auto-injection. The domain
 * sign path is `aegis.mint` / `aegis.sign`. `oid` (if wanted) rides the `header`
 * bag; the `SignedToken.objectId` sugar reads it back off it.
 */
export const rawSignJwt = async <C extends Dict = Dict>({
  claims,
  options = {},
  deps,
}: {
  claims: JwtClaimsWire & C;
  options?: JoseSignStructuredTokenOptions & { key?: AegisSignKey };
  deps: AegisDeps;
}): Promise<SignedToken> => {
  const { key, ...rest } = options;

  const kryptos = await deps.resolveSignKey({ key });

  // The SAME signer the JOSE wire's `signClaims` reaches, so the deployment
  // SHA-1 thumbprint default cannot be resolved one way for a profiled mint and
  // another for this namespace.
  const token = signJwt({ kryptos, deps, claims, options: rest });

  return buildSignedToken(token, claims, options.header?.oid, "jwt", joseName);
};
