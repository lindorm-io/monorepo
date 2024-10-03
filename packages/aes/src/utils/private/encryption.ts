import { createCipheriv, createDecipheriv } from "crypto";
import { LATEST_AES_VERSION } from "../../constants/private";
import { AesEncryptionRecord } from "../../types";
import {
  PrivateAesDecryptionOptions,
  PrivateAesEncryptionOptions,
} from "../../types/private";
import { calculateAesEncryption } from "./calculate";
import {
  assertAuthTag,
  createAuthTag,
  getInitialisationVector,
  splitContentEncryptionKey,
} from "./data";
import { getDecryptionKey, getEncryptionKey } from "./get-key";

export const encryptAes = (options: PrivateAesEncryptionOptions): AesEncryptionRecord => {
  const { data, encryption = "A256GCM", kryptos } = options;

  const {
    contentEncryptionKey,
    hkdfSalt,
    pbkdfIterations,
    pbkdfSalt,
    publicEncryptionIv,
    publicEncryptionJwk,
    publicEncryptionKey,
    publicEncryptionTag,
  } = getEncryptionKey({
    encryption,
    kryptos,
  });

  const { encryptionKey, hashKey } = splitContentEncryptionKey(
    encryption,
    contentEncryptionKey,
  );

  const aesEncryption = calculateAesEncryption(encryption);
  const initialisationVector = getInitialisationVector(encryption);
  const cipher = createCipheriv(aesEncryption, encryptionKey, initialisationVector);

  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const content = Buffer.concat([cipher.update(buffer), cipher.final()]);

  const authTag = createAuthTag({
    cipher,
    content,
    hashKey,
    encryption,
    initialisationVector,
  });

  return {
    algorithm: kryptos.algorithm,
    authTag,
    content,
    encryption,
    hkdfSalt,
    initialisationVector,
    keyId: kryptos.id,
    pbkdfIterations,
    pbkdfSalt,
    publicEncryptionIv,
    publicEncryptionJwk,
    publicEncryptionKey,
    publicEncryptionTag,
    version: LATEST_AES_VERSION,
  };
};

export const decryptAes = (options: PrivateAesDecryptionOptions): string => {
  const {
    authTag,
    content,
    encryption,
    hkdfSalt,
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
    hkdfSalt,
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
  const decipher = createDecipheriv(aesEncryption, encryptionKey, initialisationVector);

  assertAuthTag({
    authTag,
    content,
    hashKey,
    decipher,
    encryption,
    initialisationVector,
  });

  return Buffer.concat([decipher.update(content), decipher.final()]).toString("utf-8");
};
