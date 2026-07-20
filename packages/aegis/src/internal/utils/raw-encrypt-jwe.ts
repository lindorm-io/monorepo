import type { EncryptedJwe, JweEncryptOptions } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { encryptJwe } from "./encrypt-jwe.js";

/**
 * The raw JWE encrypt namespace (`aegis.jwe.encrypt`): resolve the recipient key
 * exactly as the COSE path does — same resolver, same floor, same
 * deployment-⊕-per-call selector merge — then encrypt the opaque payload.
 */
export const rawEncryptJwe = async ({
  data,
  options = {},
  deps,
}: {
  data: string;
  options?: JweEncryptOptions;
  deps: AegisDeps;
}): Promise<EncryptedJwe> => {
  const kryptos = await deps.resolveEncryptKey(options.key);

  return encryptJwe({
    kryptos,
    data,
    options,
    encryption: options.key?.encryption ?? deps.encryption,
    certBindingMode: deps.certBindingMode,
    logger: deps.logger,
  });
};
