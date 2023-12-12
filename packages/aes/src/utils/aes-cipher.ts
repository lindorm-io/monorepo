import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { AesAlgorithm, AesFormat } from "../enums";
import { AesError } from "../errors";
import { DecryptAesCipherOptions, EncryptAesCipherOptions, VerifyAesCipherOptions } from "../types";
import { decodeAesString } from "./decode-aes-string";
import { encodeAesString } from "./encode-aes-string";
import { getAesDecryptionKey, getAesEncryptionKeys } from "./private";

export const encryptAesCipher = ({
  algorithm = AesAlgorithm.AES_256_GCM,
  data,
  format = AesFormat.BASE64,
  key,
  secret,
}: EncryptAesCipherOptions): string => {
  const { encryptionKey, publicEncryptionKey } = getAesEncryptionKeys({ algorithm, key, secret });

  const initialisationVector = randomBytes(12);
  const cipher = createCipheriv(algorithm, encryptionKey, initialisationVector);

  const encryption = Buffer.concat([cipher.update(Buffer.from(data)), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return encodeAesString({
    algorithm,
    authTag,
    encryption,
    publicEncryptionKey,
    format,
    initialisationVector,
    version: 1,
  });
};

export const decryptAesCipher = ({ cipher, key, secret }: DecryptAesCipherOptions): string => {
  const { algorithm, authTag, encryption, publicEncryptionKey, initialisationVector } =
    decodeAesString(cipher);

  const decryptionKey = getAesDecryptionKey({ algorithm, key, secret, publicEncryptionKey });

  const decipher = createDecipheriv(algorithm, decryptionKey, initialisationVector);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encryption), decipher.final()]).toString("utf-8");
};

export const verifyAesCipher = ({ data, secret, cipher }: VerifyAesCipherOptions): boolean =>
  decryptAesCipher({ cipher, secret }) === data;

export const assertAesCipher = ({ data, secret, cipher }: VerifyAesCipherOptions): void => {
  if (verifyAesCipher({ cipher, data, secret })) return;
  throw new AesError("Invalid AES cipher");
};
