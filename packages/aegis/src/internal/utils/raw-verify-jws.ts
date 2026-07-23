import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import { JwsKit } from "../../classes/JwsKit.js";
import type {
  AegisVerifyKey,
  TokenContent,
  VerifiedUnstructuredToken,
  VerifyUnstructuredTokenOptions,
} from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The raw JWS verify namespace (`aegis.jws.verify`): decode the wire header,
 * resolve the verify key by its `kid`, then verify the JWS.
 */
export const rawVerifyJws = async <T extends TokenContent = Buffer>({
  jws,
  options = {},
  deps,
}: {
  jws: string;
  options?: VerifyUnstructuredTokenOptions & { key?: AegisVerifyKey };
  deps: AegisDeps;
}): Promise<VerifiedUnstructuredToken<T, string>> => {
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
  }).verify<T>(jws, { certBindingMode: options.certBindingMode });
};
