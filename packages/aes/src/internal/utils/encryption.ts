import { CipherGCMOptions, DecipherGCM, createDecipheriv } from "crypto";
import { LATEST_AES_VERSION } from "#internal/constants/version";
import { AesError } from "../../errors/AesError";
import { AesContent } from "../../types/content";
import { AesEncryptionRecord } from "../../types/aes-encryption-data";
import {
  PrivateAesDecryptionOptions,
  PrivateAesEncryptionOptions,
} from "#internal/types/aes-data";
import { calculateAesEncryption } from "#internal/utils/calculate/calculate-aes-encryption";
import { parseContent } from "#internal/utils/content";
import { assertAuthTag } from "#internal/utils/data/auth-tag";
import { splitContentEncryptionKey } from "#internal/utils/data/split-content-encryption-key";
import { getDecryptionKey } from "#internal/utils/get-key/get-decryption-key";
import { getEncryptionKey } from "#internal/utils/get-key/get-encryption-key";
import { encryptAesContent } from "#internal/utils/encrypt-content";

export const encryptAes = (options: PrivateAesEncryptionOptions): AesEncryptionRecord => {
  const { aad, data, encryption = "A256GCM", kryptos } = options;

  const keyResult = getEncryptionKey({ encryption, kryptos });

  const { authTag, content, contentType, initialisationVector } = encryptAesContent({
    aad,
    contentEncryptionKey: keyResult.contentEncryptionKey,
    data,
    encryption,
  });

  return {
    algorithm: kryptos.algorithm,
    authTag,
    content,
    contentType,
    encryption,
    initialisationVector,
    keyId: kryptos.id,
    pbkdfIterations: keyResult.pbkdfIterations,
    pbkdfSalt: keyResult.pbkdfSalt,
    publicEncryptionIv: keyResult.publicEncryptionIv,
    publicEncryptionJwk: keyResult.publicEncryptionJwk,
    publicEncryptionKey: keyResult.publicEncryptionKey,
    publicEncryptionTag: keyResult.publicEncryptionTag,
    version: LATEST_AES_VERSION,
  };
};

export const decryptAes = <T extends AesContent = string>(
  options: PrivateAesDecryptionOptions,
): T => {
  const {
    aad,
    authTag,
    content,
    contentType,
    encryption,
    initialisationVector,
    kryptos,
    pbkdfIterations,
    pbkdfSalt,
    publicEncryptionIv,
    publicEncryptionJwk,
    publicEncryptionKey,
    publicEncryptionTag,
  } = options;

  const { contentEncryptionKey } = getDecryptionKey({
    encryption,
    kryptos,
    pbkdfIterations,
    pbkdfSalt,
    publicEncryptionIv,
    publicEncryptionJwk,
    publicEncryptionKey,
    publicEncryptionTag,
  });

  const { encryptionKey, hashKey } = splitContentEncryptionKey(
    encryption,
    contentEncryptionKey,
  );

  const aesEncryption = calculateAesEncryption(encryption);
  const isGcm = encryption.includes("GCM");
  const decipherOptions: CipherGCMOptions | undefined = isGcm
    ? { authTagLength: 16 }
    : undefined;
  const decipher = createDecipheriv(
    aesEncryption,
    encryptionKey,
    initialisationVector,
    decipherOptions as CipherGCMOptions,
  );

  if (isGcm && authTag && authTag.length !== 16) {
    throw new AesError("Invalid GCM auth tag length");
  }

  if (isGcm && aad) {
    (decipher as DecipherGCM).setAAD(aad);
  }

  assertAuthTag({
    aad,
    authTag,
    content,
    hashKey,
    decipher,
    encryption,
    initialisationVector,
  });

  const final = Buffer.concat([decipher.update(content), decipher.final()]);

  return parseContent<T>(final, contentType);
};
