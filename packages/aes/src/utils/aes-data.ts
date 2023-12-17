import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { LATEST_AES_VERSION } from "../constants";
import { AesAlgorithm, AesFormat } from "../enums";
import { AesEncryptionData, DecryptAesDataOptions, EncryptAesCipherOptions } from "../types";
import { getAesDecryptionKey, getAesEncryptionKeys } from "./private";

export const encryptAesData = ({
  algorithm = AesAlgorithm.AES_256_GCM,
  data,
  format = AesFormat.BASE64,
  key,
  keyId,
  keyHash,
  secret,
}: EncryptAesCipherOptions): AesEncryptionData => {
  const { encryptionKey, isPrivateKey, publicEncryptionKey } = getAesEncryptionKeys({
    algorithm,
    key,
    keyHash,
    secret,
  });

  const initialisationVector = randomBytes(12);
  const cipher = createCipheriv(algorithm, encryptionKey, initialisationVector);

  const encryption = Buffer.concat([cipher.update(Buffer.from(data)), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    algorithm,
    authTag,
    encryption,
    format,
    initialisationVector,
    keyId: keyId ? Buffer.from(keyId) : undefined,
    keyHash: isPrivateKey ? undefined : keyHash,
    publicEncryptionKey,
    version: LATEST_AES_VERSION,
  };
};

export const decryptAesData = ({
  algorithm,
  authTag,
  encryption,
  initialisationVector,
  key,
  keyHash,
  publicEncryptionKey,
  secret,
}: DecryptAesDataOptions): string => {
  const decryptionKey = getAesDecryptionKey({
    algorithm,
    key,
    keyHash,
    secret,
    publicEncryptionKey,
  });

  const decipher = createDecipheriv(algorithm, decryptionKey, initialisationVector);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encryption), decipher.final()]).toString("utf-8");
};
