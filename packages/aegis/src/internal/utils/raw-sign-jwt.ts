import type { Dict } from "@lindorm/types";
import { JwtKit } from "../../classes/JwtKit.js";
import type {
  AegisSignKey,
  JwtClaimsWire,
  SignStructuredTokenOptions,
  SignedToken,
} from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { buildSignedJwt } from "./jwt-payload.js";

/**
 * The raw JWT sign namespace (`aegis.jwt.sign`): resolve the signing key, then
 * serialize the ALREADY-WIRE `JwtClaimsWire` verbatim via the transform-free
 * `JwtKit` (R18) — no domain translation, no envelope auto-injection. The domain
 * sign path is `aegis.mint` / `aegis.sign`. `oid` (if wanted) rides the `header`
 * bag (ruling 3); the `SignedToken.objectId` sugar reads it back off it.
 */
export const rawSignJwt = async <C extends Dict = Dict>({
  claims,
  options = {},
  deps,
}: {
  claims: JwtClaimsWire & C;
  options?: SignStructuredTokenOptions & { key?: AegisSignKey };
  deps: AegisDeps;
}): Promise<SignedToken> => {
  const { key, certificateThumbprintSha1, ...rest } = options;

  const kryptos = await deps.resolveSignKey({ key });

  const token = new JwtKit({
    certBindingMode: deps.certBindingMode,
    clockTolerance: deps.clockTolerance,
    kryptos,
    logger: deps.logger,
  }).sign<C>(claims, {
    ...rest,
    certificateThumbprintSha1:
      certificateThumbprintSha1 ?? deps.certificateThumbprintSha1,
  });

  return buildSignedJwt(token, claims, options.header?.oid, "jwt");
};
