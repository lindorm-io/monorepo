import type { IKryptos } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { JwtKit } from "../../classes/JwtKit.js";
import type { JoseSignStructuredTokenOptions } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * Sign already-wire claims as a JWT with an ALREADY-RESOLVED signing key — the
 * sign twin of {@link encryptJwe}, and the one place the JOSE claims path fills
 * the deployment SHA-1 thumbprint default in behind a call that stated nothing.
 *
 * The kit's own last-resort default for that flag is `true`; the DEPLOYMENT
 * default is a value on `Aegis`, which the kit cannot see. Resolving it here
 * keeps the wire's forward a pure rest-spread: the JOSE wire hands over the kit
 * option surface whole and never names a field of it, so nothing can be dropped
 * from that call by omission.
 *
 * Everything else the kit takes travels through `options` untouched.
 */
export const signJwt = ({
  kryptos,
  deps,
  claims,
  options,
}: {
  kryptos: IKryptos;
  deps: AegisDeps;
  claims: Dict;
  options: JoseSignStructuredTokenOptions;
}): string =>
  new JwtKit({
    certBindingMode: deps.certBindingMode,
    clockTolerance: deps.clockTolerance,
    kryptos,
    logger: deps.logger,
  }).sign(claims, options);
