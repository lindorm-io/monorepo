import { createCipheriv, createDecipheriv } from "crypto";
import { LATEST_AES_VERSION } from "../constants";
import { AesAlgorithm, AesEncryptionKeyAlgorithm, AesFormat } from "../enums";
import { DecryptAesDataOptions, EncryptAesDataOptions } from "../types";
import {
  getAuthTag,
  getDecryptionKey,
  getEncryptionKeys,
  getInitialisationVector,
  mapStringToAesAlgorithm,
  setAuthTag,
} from "./private";

export const encryptAesData = ({
  algorithm = AesAlgorithm.AES_256_GCM,
  data,
  encryptionKeyAlgorithm = AesEncryptionKeyAlgorithm.RSA_OAEP,
  format = AesFormat.BASE64_URL,
  integrityAlgorithm,
  key,
  keyId,
  secret,
}: EncryptAesDataOptions) => {
  const { encryptionKey, isPrivateKey, publicEncryptionKey } = getEncryptionKeys({
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
    integrityAlgorithm,
  });

  return {
    algorithm,
    authTag,
    content,
    format,
    initialisationVector,
    integrityAlgorithm,
    keyId: keyId ? Buffer.from(keyId) : undefined,
    encryptionKeyAlgorithm:
      !!publicEncryptionKey && !isPrivateKey ? encryptionKeyAlgorithm : undefined,
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
  integrityAlgorithm,
  key,
  publicEncryptionKey,
  secret,
}: DecryptAesDataOptions): string => {
  const decryptionKey = getDecryptionKey({
    algorithm: mapStringToAesAlgorithm(algorithm),
    key,
    encryptionKeyAlgorithm,
    secret,
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
    integrityAlgorithm,
  });

  return Buffer.concat([decipher.update(content), decipher.final()]).toString("utf-8");
};
