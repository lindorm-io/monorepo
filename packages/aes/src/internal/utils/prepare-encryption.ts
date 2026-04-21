import type {
  PrepareEncryptionOptions,
  PreparedEncryption,
} from "../types/prepared-encryption.js";
import { encryptAesContent } from "./encrypt-content.js";
import { getEncryptionKey } from "./get-key/get-encryption-key.js";

export const prepareAesEncryption = (
  options: PrepareEncryptionOptions,
): PreparedEncryption => {
  const { encryption = "A256GCM", kryptos } = options;

  const {
    contentEncryptionKey,
    pbkdfIterations,
    pbkdfSalt,
    publicEncryptionIv,
    publicEncryptionJwk,
    publicEncryptionKey,
    publicEncryptionTag,
  } = getEncryptionKey({ encryption, kryptos });

  return {
    headerParams: {
      publicEncryptionJwk,
      pbkdfIterations,
      pbkdfSalt,
      publicEncryptionIv,
      publicEncryptionTag,
    },
    publicEncryptionKey,
    encrypt: (data, opts) =>
      encryptAesContent({
        aad: opts?.aad,
        contentEncryptionKey,
        data,
        encryption,
      }),
  };
};
