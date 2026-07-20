import { JwtKit } from "../../classes/JwtKit.js";
import type {
  AegisSignKey,
  JwtWireClaims,
  SignJwtWireOptions,
  SignedJwt,
} from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { buildSignedJwt } from "./jwt-payload.js";

/**
 * The raw JWT sign namespace (`aegis.jwt.sign`): resolve the signing key, then
 * serialize the ALREADY-WIRE `JwtWireClaims` verbatim via the transform-free
 * `JwtKit` (R18) — no domain translation, no envelope auto-injection (`iat`/
 * `jti`/`nbf`/`iss`), no hash derivation. The domain sign path is `aegis.mint` /
 * `aegis.sign`; this namespace is the wire-for-wire kit passthrough. The only
 * delta over the standalone kit is Aegis-side key resolution.
 */
export const rawSignJwt = async <C extends JwtWireClaims = JwtWireClaims>({
  claims,
  options = {},
  deps,
}: {
  claims: C;
  options?: SignJwtWireOptions & { key?: AegisSignKey };
  deps: AegisDeps;
}): Promise<SignedJwt> => {
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

  return buildSignedJwt(token, claims, options.objectId);
};
