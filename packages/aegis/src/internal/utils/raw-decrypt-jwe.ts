import type { KryptosEncAlgorithm } from "@lindorm/kryptos";
import { JweKit } from "../../classes/JweKit.js";
import type {
  AegisDecryptKey,
  JoseDecryptedEncryptedToken,
  DecryptTokenOptions,
  TokenContent,
} from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The raw JWE decrypt namespace (`aegis.jwe.decrypt`): decode the wire header,
 * resolve the recipient key by the ciphertext's own `kid`, then decrypt.
 */
export const rawDecryptJwe = async <T extends TokenContent = Buffer>({
  jwe,
  options = {},
  deps,
}: {
  jwe: string;
  options?: DecryptTokenOptions & { key?: AegisDecryptKey };
  deps: AegisDeps;
}): Promise<JoseDecryptedEncryptedToken<T>> => {
  // `key` is the aegis-only external-key injection (it resolves the kryptos);
  // every other field IS the kit's DecryptTokenOptions and is forwarded
  // structurally, so a new decrypt option threads through with no change here.
  const { key, ...decryptOptions } = options;

  const decode = JweKit.decode(jwe);

  const kryptos = await deps.resolveDecryptKey(
    decode.header.kid,
    decode.header.alg as KryptosEncAlgorithm,
    key,
  );

  return new JweKit({
    certBindingMode: deps.certBindingMode,
    defaultEncryption: deps.defaultEncryption,
    kryptos,
    logger: deps.logger,
    partyRecipient: deps.partyRecipient,
  }).decrypt<T>(jwe, decryptOptions);
};
