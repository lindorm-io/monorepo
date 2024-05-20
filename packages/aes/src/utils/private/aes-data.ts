import { createCipheriv, createDecipheriv } from "crypto";
import { LATEST_AES_VERSION } from "../../constants";
import { _B64U } from "../../constants/private/format";
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
    hkdfSalt,
    initialisationVector,
    keyId: Buffer.from(kryptos.id, _B64U),
    pbkdfIterations,
    pbkdfSalt,
    publicEncryptionIv,
    publicEncryptionJwk,
    publicEncryptionKey,
    publicEncryptionTag,
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
    publicEncryptionIv,
    publicEncryptionJwk,
    publicEncryptionKey,
    publicEncryptionTag,
  } = options;

  const { contentEncryptionKey } = _getDecryptionKey({
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
