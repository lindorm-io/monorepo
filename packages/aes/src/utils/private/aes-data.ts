import { createCipheriv, createDecipheriv } from "crypto";
import { LATEST_AES_VERSION } from "../../constants";
import {
  AesEncryptionData,
  AesEncryptionKeyAlgorithm,
  DecryptAesDataOptions,
  EncryptAesDataOptions,
} from "../../types";
import { _getAuthTag, _setAuthTag } from "./auth-tag";
import { _getDecryptionKey } from "./get-decryption-key";
import { _getEncryptionKeys } from "./get-encryption-keys";
import { _getInitialisationVector } from "./get-initialisation-vector";

export const _encryptAesData = (options: EncryptAesDataOptions): AesEncryptionData => {
  const {
    data,
    encryption = "aes-256-gcm",
    format = "base64url",
    integrityHash,
    kryptos,
  } = options;

  const { encryptionKey, publicEncryptionJwk, publicEncryptionKey } = _getEncryptionKeys({
    encryption,
    kryptos,
  });

  const initialisationVector = _getInitialisationVector(encryption);
  const cipher = createCipheriv(encryption, encryptionKey, initialisationVector);
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const content = Buffer.concat([cipher.update(buffer), cipher.final()]);

  const authTag = _getAuthTag({
    encryption,
    cipher,
    content,
    encryptionKey,
    initialisationVector,
    integrityHash,
  });

  return {
    encryption,
    authTag,
    content,
    format,
    initialisationVector,
    integrityHash,
    keyId: kryptos.id ? Buffer.from(kryptos.id, format) : undefined,
    encryptionKeyAlgorithm: kryptos.algorithm as AesEncryptionKeyAlgorithm,
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
    initialisationVector,
    integrityHash,
    kryptos,
    publicEncryptionJwk,
    publicEncryptionKey,
  } = options;

  const decryptionKey = _getDecryptionKey({
    encryption,
    kryptos,
    publicEncryptionJwk,
    publicEncryptionKey,
  });

  const decipher = createDecipheriv(encryption, decryptionKey, initialisationVector);

  _setAuthTag({
    encryption,
    authTag,
    content,
    decipher,
    decryptionKey,
    initialisationVector,
    integrityHash,
  });

  return Buffer.concat([decipher.update(content), decipher.final()]).toString("utf-8");
};
