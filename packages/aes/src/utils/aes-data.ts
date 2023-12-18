import { createCipheriv, createDecipheriv } from "crypto";
import { LATEST_AES_VERSION } from "../constants";
import { AesAlgorithm, AesFormat } from "../enums";
import { AesEncryptionData, DecryptAesDataOptions, EncryptAesCipherOptions } from "../types";
import {
  getAesDecryptionKey,
  getAesEncryptionKeys,
  getAuthTag,
  getInitialisationVector,
  setAuthTag,
} from "./private";

export const encryptAesData = ({
  algorithm = AesAlgorithm.AES_256_GCM,
  data,
  format = AesFormat.BASE64,
  key,
  keyId,
  encryptionKeyAlgorithm,
  secret,
}: EncryptAesCipherOptions): AesEncryptionData => {
  const { encryptionKey, isPrivateKey, publicEncryptionKey } = getAesEncryptionKeys({
    algorithm,
    key,
    encryptionKeyAlgorithm,
    secret,
  });

  const initialisationVector = getInitialisationVector(algorithm);
  const cipher = createCipheriv(algorithm, encryptionKey, initialisationVector);
  const content = Buffer.concat([cipher.update(Buffer.from(data)), cipher.final()]);
  const authTag = getAuthTag(algorithm, cipher);

  return {
    algorithm,
    authTag,
    content,
    format,
    initialisationVector,
    keyId: keyId ? Buffer.from(keyId) : undefined,
    encryptionKeyAlgorithm: isPrivateKey ? undefined : encryptionKeyAlgorithm,
    publicEncryptionKey,
    version: LATEST_AES_VERSION,
  };
};

export const decryptAesData = ({
  algorithm,
  authTag,
  content,
  initialisationVector,
  key,
  encryptionKeyAlgorithm,
  publicEncryptionKey,
  secret,
}: DecryptAesDataOptions): string => {
  const decryptionKey = getAesDecryptionKey({
    algorithm,
    key,
    encryptionKeyAlgorithm,
    secret,
    publicEncryptionKey,
  });

  const decipher = createDecipheriv(algorithm, decryptionKey, initialisationVector);
  setAuthTag(algorithm, decipher, authTag);

  return Buffer.concat([decipher.update(content), decipher.final()]).toString("utf-8");
};
