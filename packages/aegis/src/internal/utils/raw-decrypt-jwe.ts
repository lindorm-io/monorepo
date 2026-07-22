import type { KryptosEncAlgorithm } from "@lindorm/kryptos";
import { JweKit } from "../../classes/JweKit.js";
import type { DecryptedJwe, JweDecryptOptions } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The raw JWE decrypt namespace (`aegis.jwe.decrypt`): decode the wire header,
 * resolve the recipient key by the ciphertext's own `kid`, then decrypt.
 */
export const rawDecryptJwe = async ({
  jwe,
  options = {},
  deps,
}: {
  jwe: string;
  options?: JweDecryptOptions;
  deps: AegisDeps;
}): Promise<DecryptedJwe> => {
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
  }).decrypt(jwe);
};
