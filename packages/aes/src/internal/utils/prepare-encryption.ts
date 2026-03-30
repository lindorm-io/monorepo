import {
  PrepareEncryptionOptions,
  PreparedEncryption,
} from "#internal/types/prepared-encryption";
import { encryptAesContent } from "#internal/utils/encrypt-content";
import { getEncryptionKey } from "#internal/utils/get-key/get-encryption-key";

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
