import type {
  AegisEncKey,
  EncryptedToken,
  JweEncryptOptions,
  TokenContent,
} from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { encryptJwe } from "./encrypt-jwe.js";

/**
 * The raw JWE encrypt namespace (`aegis.jwe.encrypt`): resolve the recipient key
 * exactly as the COSE path does — same resolver, same floor, same
 * deployment-⊕-per-call selector merge — then encrypt the opaque payload. The kit
 * returns the bare token; this namespace wraps it in the domain `EncryptedToken`.
 */
export const rawEncryptJwe = async ({
  data,
  options = {},
  deps,
}: {
  data: TokenContent;
  options?: JweEncryptOptions & { key?: AegisEncKey };
  deps: AegisDeps;
}): Promise<EncryptedToken> => {
  const kryptos = await deps.resolveEncryptKey(options.key);

  const token = encryptJwe({
    kryptos,
    data,
    options,
    encryption: options.key?.encryption ?? deps.encryption,
    certBindingMode: deps.certBindingMode,
    certificateThumbprintSha1: deps.certificateThumbprintSha1,
    logger: deps.logger,
  });

  return { format: "jwe", token };
};
