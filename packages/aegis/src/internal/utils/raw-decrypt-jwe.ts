import type { KryptosEncAlgorithm } from "@lindorm/kryptos";
import { JweKit } from "../../classes/JweKit.js";
import type {
  AegisDecryptKey,
  DecryptedEncryptedToken,
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
}): Promise<DecryptedEncryptedToken<T, string>> => {
  const decode = JweKit.decodeSegments(jwe);

  const kryptos = await deps.resolveDecryptKey(
    decode.header.kid,
    decode.header.alg as KryptosEncAlgorithm,
    options.key,
  );

  return new JweKit({
    certBindingMode: deps.certBindingMode,
    encryption: deps.encryption,
    kryptos,
    logger: deps.logger,
    partyRecipient: deps.partyRecipient,
  }).decrypt<T>(jwe);
};
