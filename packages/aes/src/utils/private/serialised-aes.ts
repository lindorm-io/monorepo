import { B64 } from "@lindorm/b64";
import {
  AesDecryptionRecord,
  AesEncryptionRecord,
  SerialisedAesDecryption,
  SerialisedAesEncryption,
} from "../../types";

export const createSerialisedAesRecord = (
  data: AesEncryptionRecord,
): SerialisedAesEncryption => ({
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

export const parseSerialisedAesRecord = (
  options: SerialisedAesDecryption,
): AesDecryptionRecord => ({
  algorithm: options.algorithm,
  authTag: options.authTag ? B64.toBuffer(options.authTag) : undefined,
  content: B64.toBuffer(options.content),
  encryption: options.encryption,
  hkdfSalt: options.hkdfSalt ? B64.toBuffer(options.hkdfSalt) : undefined,
  initialisationVector: B64.toBuffer(options.initialisationVector),
  keyId: options.keyId,
  pbkdfIterations: options.pbkdfIterations,
  pbkdfSalt: options.pbkdfSalt ? B64.toBuffer(options.pbkdfSalt) : undefined,
  publicEncryptionIv: options.publicEncryptionIv
    ? B64.toBuffer(options.publicEncryptionIv)
    : undefined,
  publicEncryptionJwk: options.publicEncryptionJwk,
  publicEncryptionKey: options.publicEncryptionKey
    ? B64.toBuffer(options.publicEncryptionKey)
    : undefined,
  publicEncryptionTag: options.publicEncryptionTag
    ? B64.toBuffer(options.publicEncryptionTag)
    : undefined,
  version: options.version,
});
