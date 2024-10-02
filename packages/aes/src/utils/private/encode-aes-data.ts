import { B64 } from "@lindorm/b64";
import { AesEncryptionData, AesEncryptionDataEncoded } from "../../types";

export const encodeAesData = (data: AesEncryptionData): AesEncryptionDataEncoded => ({
  algorithm: data.algorithm,
  authTag: B64.encode(data.authTag),
  content: B64.encode(data.content),
  encryption: data.encryption,
  hkdfSalt: data.hkdfSalt ? B64.encode(data.hkdfSalt) : undefined,
  initialisationVector: B64.encode(data.initialisationVector),
  keyId: data.keyId,
  pbkdfIterations: data.pbkdfIterations,
  pbkdfSalt: data.pbkdfSalt ? B64.encode(data.pbkdfSalt) : undefined,
  publicEncryptionIv: data.publicEncryptionIv
    ? B64.encode(data.publicEncryptionIv)
    : undefined,
  publicEncryptionJwk: data.publicEncryptionJwk,
  publicEncryptionKey: data.publicEncryptionKey
    ? B64.encode(data.publicEncryptionKey)
    : undefined,
  publicEncryptionTag: data.publicEncryptionTag
    ? B64.encode(data.publicEncryptionTag)
    : undefined,
  version: data.version,
});
