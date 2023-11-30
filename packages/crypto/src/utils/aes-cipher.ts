import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { CryptoError } from "../error";
import {
  AesCipherAlgorithm,
  DecryptAesCipherOptions,
  EncryptAesCipherOptions,
  VerifyAesCipherOptions,
} from "../types";

const assertAesCipherSecret = (secret: string, algorithm: AesCipherAlgorithm): void => {
  if (algorithm === "aes-128-gcm" && secret.length !== 16) {
    throw new CryptoError("Secret must be 16 characters long");
  }

  if (algorithm === "aes-192-gcm" && secret.length !== 24) {
    throw new CryptoError("Secret must be 24 characters long");
  }

  if (algorithm === "aes-256-gcm" && secret.length !== 32) {
    throw new CryptoError("Secret must be 32 characters long");
  }
};

export const encryptAesCipher = ({
  algorithm = "aes-256-gcm",
  data,
  format = "base64",
  secret,
}: EncryptAesCipherOptions): string => {
  assertAesCipherSecret(secret, algorithm);

  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, Buffer.from(secret), iv);
  const encryptedBuffer = Buffer.concat([cipher.update(Buffer.from(data)), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const bufferLength = Buffer.alloc(1);
  bufferLength.writeUInt8(iv.length, 0);

  return Buffer.concat([bufferLength, iv, authTag, encryptedBuffer]).toString(format);
};

export const decryptAesCipher = ({
  algorithm = "aes-256-gcm",
  format = "base64",
  secret,
  cipher,
}: DecryptAesCipherOptions): string => {
  assertAesCipherSecret(secret, algorithm);

  const dataBuffer = Buffer.from(cipher, format);
  const ivSize = dataBuffer.readUInt8(0);
  const iv = dataBuffer.subarray(1, ivSize + 1);

  // The authTag is by default 16 bytes in AES-GCM
  const authTag = dataBuffer.subarray(ivSize + 1, ivSize + 17);
  const decipher = createDecipheriv(algorithm, Buffer.from(secret), iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(dataBuffer.subarray(ivSize + 17)),
    decipher.final(),
  ]).toString("utf-8");
};

export const verifyAesCipher = ({
  algorithm,
  data,
  format,
  secret,
  cipher,
}: VerifyAesCipherOptions): boolean =>
  decryptAesCipher({ algorithm, cipher, format, secret }) === data;

export const assertAesCipher = ({
  algorithm,
  data,
  format,
  secret,
  cipher,
}: VerifyAesCipherOptions): void => {
  if (verifyAesCipher({ algorithm, cipher, data, format, secret })) return;
  throw new CryptoError("Invalid AES cipher");
};
