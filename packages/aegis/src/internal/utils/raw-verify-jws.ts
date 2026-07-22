import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import { JwsKit } from "../../classes/JwsKit.js";
import type { JwsContent, ParsedJws, VerifyJwsOptions } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The raw JWS verify namespace (`aegis.jws.verify`): decode the wire header,
 * resolve the verify key by its `kid`, then verify the JWS.
 */
export const rawVerifyJws = async <T extends JwsContent>({
  jws,
  options = {},
  deps,
}: {
  jws: string;
  options?: VerifyJwsOptions;
  deps: AegisDeps;
}): Promise<ParsedJws<T>> => {
  const decode = JwsKit.decodeSegments(jws);

  const kryptos = await deps.resolveVerifyKey(
    decode.header.kid,
    decode.header.alg as KryptosSigAlgorithm,
    options.key,
  );

  return new JwsKit({
    certBindingMode: deps.certBindingMode,
    kryptos,
    logger: deps.logger,
  }).verify(jws);
};
