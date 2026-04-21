import { type CipherGCMOptions, type DecipherGCM, createDecipheriv } from "crypto";
import { LATEST_AES_VERSION } from "../constants/version.js";
import { AesError } from "../../errors/AesError.js";
import type { AesContent } from "../../types/content.js";
import type { AesEncryptionRecord } from "../../types/aes-encryption-data.js";
import type {
  PrivateAesDecryptionOptions,
  PrivateAesEncryptionOptions,
} from "../types/aes-data.js";
import { calculateAesEncryption } from "./calculate/calculate-aes-encryption.js";
import { parseContent } from "./content.js";
import { assertAuthTag } from "./data/auth-tag.js";
import { splitContentEncryptionKey } from "./data/split-content-encryption-key.js";
import { getDecryptionKey } from "./get-key/get-decryption-key.js";
import { getEncryptionKey } from "./get-key/get-encryption-key.js";
import { encryptAesContent } from "./encrypt-content.js";

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
