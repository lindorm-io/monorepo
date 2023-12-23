import { createCipheriv, createDecipheriv } from "crypto";
import { LATEST_AES_VERSION } from "../constants";
import { AesAlgorithm, AesEncryptionKeyAlgorithm, AesFormat } from "../enums";
import { AesEncryptionData, DecryptAesDataOptions, EncryptAesDataOptions } from "../types";
import {
  getAuthTag,
  getDecryptionKey,
  getEncryptionKeys,
  getInitialisationVector,
  getKeyId,
  isPublicKey,
  mapStringToAesAlgorithm,
  setAuthTag,
} from "./private";

export const encryptAesData = ({
  algorithm = AesAlgorithm.AES_256_GCM,
  data,
  encryptionKeyAlgorithm = AesEncryptionKeyAlgorithm.RSA_OAEP,
  format = AesFormat.BASE64_URL,
  integrityHash,
  key,
  secret,
}: EncryptAesDataOptions): AesEncryptionData => {
  const { encryptionKey, publicEncryptionJwk, publicEncryptionKey } = getEncryptionKeys({
    algorithm,
    key,
    secret,
    encryptionKeyAlgorithm,
  });

  const initialisationVector = getInitialisationVector(algorithm);
  const cipher = createCipheriv(algorithm, encryptionKey, initialisationVector);
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const content = Buffer.concat([cipher.update(buffer), cipher.final()]);

  const authTag = getAuthTag({
    algorithm,
    cipher,
    content,
    encryptionKey,
    initialisationVector,
    integrityHash,
  });

  const keyId = getKeyId(key);
  const publicKey = isPublicKey(key);

  return {
    algorithm,
    authTag,
    content,
    format,
    initialisationVector,
    integrityHash,
    keyId: keyId ? Buffer.from(keyId, format) : undefined,
    encryptionKeyAlgorithm: publicKey && publicEncryptionKey ? encryptionKeyAlgorithm : undefined,
    publicEncryptionJwk,
    publicEncryptionKey,
    version: LATEST_AES_VERSION,
  };
};

export const decryptAesData = ({
  algorithm,
  authTag,
  content,
  encryptionKeyAlgorithm,
  initialisationVector,
  integrityHash,
  key,
  publicEncryptionJwk,
  publicEncryptionKey,
  secret,
}: DecryptAesDataOptions): string => {
  const decryptionKey = getDecryptionKey({
    algorithm: mapStringToAesAlgorithm(algorithm),
    key,
    encryptionKeyAlgorithm,
    secret,
    publicEncryptionJwk,
    publicEncryptionKey,
  });

  const decipher = createDecipheriv(algorithm, decryptionKey, initialisationVector);

  setAuthTag({
    algorithm,
    authTag,
    content,
    decipher,
    decryptionKey,
    initialisationVector,
    integrityHash,
  });

  return Buffer.concat([decipher.update(content), decipher.final()]).toString("utf-8");
};
