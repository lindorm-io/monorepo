import { B64 } from "@lindorm/b64";
import { isBuffer } from "@lindorm/is";
import { DecryptAesDataEncodedOptions, DecryptAesDataOptions } from "../../types";

export const decodeAesDataOptions = (
  options:
    | Omit<DecryptAesDataOptions, "kryptos">
    | Omit<DecryptAesDataEncodedOptions, "kryptos">
    | string,
): Omit<DecryptAesDataOptions, "kryptos"> => {
  if (Object.values(options).some((x) => isBuffer(x))) {
    return options as DecryptAesDataOptions;
  }

  const data = options as DecryptAesDataEncodedOptions;

  return {
    authTag: data.authTag ? B64.toBuffer(data.authTag) : undefined,
    content: B64.toBuffer(data.content),
    encryption: data.encryption,
    hkdfSalt: data.hkdfSalt ? B64.toBuffer(data.hkdfSalt) : undefined,
    initialisationVector: B64.toBuffer(data.initialisationVector),
    pbkdfIterations: data.pbkdfIterations,
    pbkdfSalt: data.pbkdfSalt ? B64.toBuffer(data.pbkdfSalt) : undefined,
    publicEncryptionIv: data.publicEncryptionIv
      ? B64.toBuffer(data.publicEncryptionIv)
      : undefined,
    publicEncryptionJwk: data.publicEncryptionJwk,
    publicEncryptionKey: data.publicEncryptionKey
      ? B64.toBuffer(data.publicEncryptionKey)
      : undefined,
    publicEncryptionTag: data.publicEncryptionTag
      ? B64.toBuffer(data.publicEncryptionTag)
      : undefined,
  };
};
