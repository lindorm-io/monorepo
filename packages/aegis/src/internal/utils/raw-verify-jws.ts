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
  const decode = JwsKit.decode(jws);

  // UNSCOPED by construction: a JWS is opaque — its payload is arbitrary bytes
  // with no claims layer, so there is no `iss` to narrow the kid lookup by. Not
  // an oversight; see the unscoped-paths note in `resolve-key.ts`.
  const kryptos = await deps.resolveVerifyKey({
    id: decode.protectedHeader.kid,
    algorithm: decode.protectedHeader.alg as KryptosSigAlgorithm,
    verify: options.key,
  });

  return new JwsKit({
    certBindingMode: deps.certBindingMode,
    kryptos,
    logger: deps.logger,
  }).verify<T>(jws, { certBindingMode: options.certBindingMode });
};
