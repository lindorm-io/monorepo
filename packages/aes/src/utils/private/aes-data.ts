import { createCipheriv, createDecipheriv } from "crypto";
import { LATEST_AES_VERSION } from "../../constants";
import {
  AesEncryptionData,
  DecryptAesDataOptions,
  EncryptAesDataOptions,
} from "../../types";
import { _assertAuthTag, _createAuthTag } from "./aes-data/auth-tag";
import { _getInitialisationVector } from "./aes-data/get-initialisation-vector";
import { _splitContentEncryptionKey } from "./aes-data/split-content-encryption-key";
import { _calculateAesEncryption } from "./calculate/calculate-aes-encryption";
import { _getDecryptionKey } from "./get-key/get-decryption-key";
import { _getEncryptionKey } from "./get-key/get-encryption-key";

export const _encryptAesData = (options: EncryptAesDataOptions): AesEncryptionData => {
  const { data, encryption = "A256GCM", format = "base64url", kryptos } = options;

  const {
    contentEncryptionKey,
    hkdfSalt,
    pbkdfIterations,
    pbkdfSalt,
    publicEncryptionJwk,
    publicEncryptionKey,
  } = _getEncryptionKey({
    encryption,
    kryptos,
  });

  const { encryptionKey, hashKey } = _splitContentEncryptionKey(
    encryption,
    contentEncryptionKey,
  );

  const aesEncryption = _calculateAesEncryption(encryption);
  const initialisationVector = _getInitialisationVector(encryption);
  const cipher = createCipheriv(aesEncryption, encryptionKey, initialisationVector);

  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const content = Buffer.concat([cipher.update(buffer), cipher.final()]);

  const authTag = _createAuthTag({
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
    format,
    hkdfSalt,
    initialisationVector,
    keyId: Buffer.from(kryptos.id, format),
    pbkdfIterations,
    pbkdfSalt,
    publicEncryptionJwk,
    publicEncryptionKey,
    version: LATEST_AES_VERSION,
  };
};

export const _decryptAesData = (options: DecryptAesDataOptions): string => {
  const {
    authTag,
    content,
    encryption,
    hkdfSalt,
    initialisationVector,
    kryptos,
    pbkdfIterations,
    pbkdfSalt,
    publicEncryptionJwk,
    publicEncryptionKey,
  } = options;

  const { contentEncryptionKey } = _getDecryptionKey({
    encryption,
    hkdfSalt,
    kryptos,
    pbkdfIterations,
    pbkdfSalt,
    publicEncryptionJwk,
    publicEncryptionKey,
  });

  const { encryptionKey, hashKey } = _splitContentEncryptionKey(
    encryption,
    contentEncryptionKey,
  );

  const aesEncryption = _calculateAesEncryption(encryption);
  const decipher = createDecipheriv(aesEncryption, encryptionKey, initialisationVector);

  _assertAuthTag({
    authTag,
    content,
    hashKey,
    decipher,
    encryption,
    initialisationVector,
  });

  return Buffer.concat([decipher.update(content), decipher.final()]).toString("utf-8");
};
