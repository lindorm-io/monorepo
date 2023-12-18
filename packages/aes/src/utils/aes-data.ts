import { createCipheriv, createDecipheriv } from "crypto";
import { LATEST_AES_VERSION } from "../constants";
import { AesAlgorithm, AesEncryptionKeyAlgorithm, AesFormat } from "../enums";
import { AesEncryptionData, DecryptAesDataOptions, EncryptAesCipherOptions } from "../types";
import {
  getAesDecryptionKey,
  getAesEncryptionKeys,
  getAuthTag,
  getInitialisationVector,
  setAuthTag,
} from "./private";
import {
  mapAesAlgorithmToCryptoAlgorithm,
  mapCipherAlgorithmToAesAlgorithm,
} from "./private/cipher-algorithm-mapper";

export const encryptAesData = ({
  algorithm = AesAlgorithm.AES_256_GCM,
  data,
  format = AesFormat.BASE64_URL,
  key,
  keyId,
  encryptionKeyAlgorithm = AesEncryptionKeyAlgorithm.RSA_OAEP_256,
  secret,
}: EncryptAesCipherOptions): AesEncryptionData => {
  const { encryptionKey, isPrivateKey, publicEncryptionKey } = getAesEncryptionKeys({
    algorithm,
    key,
    encryptionKeyAlgorithm,
    secret,
  });
  const initialisationVector = getInitialisationVector(algorithm);
  const cipher = createCipheriv(
    mapAesAlgorithmToCryptoAlgorithm(algorithm),
    encryptionKey,
    initialisationVector,
  );
  const content = Buffer.concat([cipher.update(Buffer.from(data)), cipher.final()]);
  const authTag = getAuthTag({
    algorithm,
    cipher,
    content,
    encryptionKey,
    initialisationVector,
  });

  return {
    algorithm,
    authTag,
    content,
    format,
    initialisationVector,
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
  initialisationVector,
  key,
  encryptionKeyAlgorithm,
  publicEncryptionKey,
  secret,
}: DecryptAesDataOptions): string => {
  const decryptionKey = getAesDecryptionKey({
    algorithm: mapCipherAlgorithmToAesAlgorithm(algorithm),
    key,
    encryptionKeyAlgorithm,
    secret,
    publicEncryptionKey,
  });
  const decipher = createDecipheriv(
    mapAesAlgorithmToCryptoAlgorithm(algorithm),
    decryptionKey,
    initialisationVector,
  );

  setAuthTag({ algorithm, authTag, content, decipher, decryptionKey, initialisationVector });

  return Buffer.concat([decipher.update(content), decipher.final()]).toString("utf-8");
};
