import { createCipheriv, createDecipheriv } from "crypto";
import { LATEST_AES_VERSION } from "../constants";
import { AesEncryptionData, DecryptAesDataOptions, EncryptAesDataOptions } from "../types";
import {
  getAuthTag,
  getDecryptionKey,
  getEncryptionKeys,
  getInitialisationVector,
  getKeySet,
  setAuthTag,
} from "./private";

export const encryptAesData = (options: EncryptAesDataOptions): AesEncryptionData => {
  const {
    encryption = "aes-256-gcm",
    data,
    encryptionKeyAlgorithm,
    format = "base64url",
    integrityHash,
  } = options;

  const keySet = getKeySet(options);

  const { encryptionKey, publicEncryptionJwk, publicEncryptionKey } = getEncryptionKeys({
    encryption,
    keySet,
    encryptionKeyAlgorithm,
  });

  const initialisationVector = getInitialisationVector(encryption);
  const cipher = createCipheriv(encryption, encryptionKey, initialisationVector);
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const content = Buffer.concat([cipher.update(buffer), cipher.final()]);

  const authTag = getAuthTag({
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
    keyId: keySet.id ? Buffer.from(keySet.id, format) : undefined,
    encryptionKeyAlgorithm:
      encryptionKeyAlgorithm && publicEncryptionKey ? encryptionKeyAlgorithm : undefined,
    publicEncryptionJwk,
    publicEncryptionKey,
    version: LATEST_AES_VERSION,
  };
};

export const decryptAesData = (options: DecryptAesDataOptions): string => {
  const {
    encryption,
    authTag,
    content,
    encryptionKeyAlgorithm,
    initialisationVector,
    integrityHash,
    publicEncryptionJwk,
    publicEncryptionKey,
  } = options;

  const keySet = getKeySet(options);

  const decryptionKey = getDecryptionKey({
    encryption,
    encryptionKeyAlgorithm,
    keySet,
    publicEncryptionJwk,
    publicEncryptionKey,
  });

  const decipher = createDecipheriv(encryption, decryptionKey, initialisationVector);

  setAuthTag({
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
