import { createCipheriv, createDecipheriv } from "crypto";
import { LATEST_AES_VERSION } from "../constants";
import { AesEncryptionData, DecryptAesDataOptions, EncryptAesDataOptions } from "../types";
import { _getAuthTag, _setAuthTag } from "./private/auth-tag";
import { _getDecryptionKey } from "./private/get-decryption-key";
import { _getEncryptionKeys } from "./private/get-encryption-keys";
import { _getInitialisationVector } from "./private/get-initialisation-vector";

export const encryptAesData = (options: EncryptAesDataOptions): AesEncryptionData => {
  const {
    data,
    encryption = "aes-256-gcm",
    encryptionKeyAlgorithm,
    format = "base64url",
    integrityHash,
    kryptos,
  } = options;

  const { encryptionKey, publicEncryptionJwk, publicEncryptionKey } = _getEncryptionKeys({
    encryption,
    kryptos,
    encryptionKeyAlgorithm,
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
    encryptionKeyAlgorithm:
      encryptionKeyAlgorithm && publicEncryptionKey ? encryptionKeyAlgorithm : undefined,
    publicEncryptionJwk,
    publicEncryptionKey,
    version: LATEST_AES_VERSION,
  };
};

export const decryptAesData = (options: DecryptAesDataOptions): string => {
  const {
    authTag,
    content,
    encryption,
    encryptionKeyAlgorithm,
    initialisationVector,
    integrityHash,
    kryptos,
    publicEncryptionJwk,
    publicEncryptionKey,
  } = options;

  const decryptionKey = _getDecryptionKey({
    encryption,
    encryptionKeyAlgorithm,
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
