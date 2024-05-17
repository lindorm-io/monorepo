import { createCipheriv, createDecipheriv } from "crypto";
import { LATEST_AES_VERSION } from "../../constants";
import {
  AesEncryptionData,
  AesEncryptionKeyAlgorithm,
  DecryptAesDataOptions,
  EncryptAesDataOptions,
} from "../../types";
import { _getAuthTag, _setAuthTag } from "./aes-data/auth-tag";
import { _getInitialisationVector } from "./aes-data/get-initialisation-vector";
import { _getDecryptionKey } from "./get-key/get-decryption-key";
import { _getEncryptionKey } from "./get-key/get-encryption-key";

export const _encryptAesData = (options: EncryptAesDataOptions): AesEncryptionData => {
  const {
    data,
    encryption = "aes-256-gcm",
    format = "base64url",
    integrityHash,
    kryptos,
  } = options;

  const { contentEncryptionKey, publicEncryptionJwk, publicEncryptionKey, salt } =
    _getEncryptionKey({
      encryption,
      kryptos,
    });

  const initialisationVector = _getInitialisationVector(encryption);
  const cipher = createCipheriv(encryption, contentEncryptionKey, initialisationVector);
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const content = Buffer.concat([cipher.update(buffer), cipher.final()]);

  const authTag = _getAuthTag({
    cipher,
    content,
    contentEncryptionKey,
    encryption,
    initialisationVector,
    integrityHash,
  });

  return {
    authTag,
    content,
    encryption,
    encryptionKeyAlgorithm: kryptos.algorithm as AesEncryptionKeyAlgorithm,
    format,
    initialisationVector,
    integrityHash,
    keyId: kryptos.id ? Buffer.from(kryptos.id, format) : undefined,
    publicEncryptionJwk,
    publicEncryptionKey,
    salt,
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
    salt,
  } = options;

  const contentEncryptionKey = _getDecryptionKey({
    encryption,
    kryptos,
    publicEncryptionJwk,
    publicEncryptionKey,
    salt,
  });

  const decipher = createDecipheriv(
    encryption,
    contentEncryptionKey,
    initialisationVector,
  );

  _setAuthTag({
    authTag,
    content,
    contentEncryptionKey,
    decipher,
    encryption,
    initialisationVector,
    integrityHash,
  });

  return Buffer.concat([decipher.update(content), decipher.final()]).toString("utf-8");
};
