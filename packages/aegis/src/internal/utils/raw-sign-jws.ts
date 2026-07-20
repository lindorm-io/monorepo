import { JwsKit } from "../../classes/JwsKit.js";
import type { JwsContent, SignedJws, SignJwsOptions } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The raw JWS sign namespace (`aegis.jws.sign`): resolve the signing key and sign
 * the opaque payload as a JWS. The ergonomic surface over the same signer the
 * `sign` verb dispatches to.
 */
export const rawSignJws = async <T extends JwsContent>({
  data,
  options = {},
  deps,
}: {
  data: T;
  options?: SignJwsOptions;
  deps: AegisDeps;
}): Promise<SignedJws> => {
  const kryptos = await deps.resolveSignKey(options);

  return new JwsKit({
    certBindingMode: deps.certBindingMode,
    kryptos,
    logger: deps.logger,
  }).sign(data, {
    ...options,
    certificateThumbprintSha1:
      options.certificateThumbprintSha1 ?? deps.certificateThumbprintSha1,
  });
};
