import { PrepareEncryptionOptions, PreparedEncryption } from "../../types/private";
import { encryptAesContent } from "./encrypt-content";
import { getEncryptionKey } from "./get-key";

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
