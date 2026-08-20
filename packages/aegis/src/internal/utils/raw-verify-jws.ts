import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import { JwsKit } from "../../classes/JwsKit.js";
import type {
  AegisVerifyKey,
  TokenContent,
  JoseVerifiedUnstructuredToken,
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
}): Promise<JoseVerifiedUnstructuredToken<T>> => {
  // `key` is the aegis-only external-key injection (it resolves the kryptos);
  // every other field IS the kit's VerifyUnstructuredTokenOptions and is
  // forwarded structurally, so a new verify option threads through with no change
  // here — the same shape `rawVerifyCws` uses.
  const { key, ...verifyOptions } = options;

  const decode = JwsKit.decode(jws);

  // UNSCOPED by construction: a JWS is opaque — its payload is arbitrary bytes
  // with no claims layer, so there is no `iss` to narrow the kid lookup by. Not
  // an oversight; see the unscoped-paths note in `resolve-key.ts`.
  const kryptos = await deps.resolveVerifyKey({
    id: decode.header.kid,
    algorithm: decode.header.alg as KryptosSigAlgorithm,
    verify: key,
  });

  return new JwsKit({
    certBindingMode: deps.certBindingMode,
    kryptos,
    logger: deps.logger,
  }).verify<T>(jws, verifyOptions);
};
