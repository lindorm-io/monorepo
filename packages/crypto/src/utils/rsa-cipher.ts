import { privateDecrypt, privateEncrypt, publicDecrypt, publicEncrypt } from "crypto";
import {
  DecryptRsaCipherOptions,
  EncryptRsaCipherOptions,
  RsaCipherKey,
  VerifyRsaCipherOptions,
} from "../types";

const isPrivate = (key: RsaCipherKey): boolean => {
  const string = typeof key === "string" ? key : key.key;
  return string.includes("PRIVATE KEY");
};

export const encryptRsaCipher = ({ format = "base64", data, key }: EncryptRsaCipherOptions) => {
  const action = isPrivate(key) ? privateEncrypt : publicEncrypt;
  return action(key, Buffer.from(data)).toString(format);
};

export const decryptRsaCipher = ({ cipher, format = "base64", key }: DecryptRsaCipherOptions) => {
  const action = isPrivate(key) ? privateDecrypt : publicDecrypt;
  return action(key, Buffer.from(cipher, format)).toString();
};

export const verifyRsaCipher = ({ cipher, data, format, key }: VerifyRsaCipherOptions) =>
  decryptRsaCipher({ cipher, format, key }) === data;

export const assertRsaCipher = ({ cipher, data, format, key }: VerifyRsaCipherOptions) => {
  if (verifyRsaCipher({ cipher, data, format, key })) return;
  throw new Error("Invalid RSA cipher");
};
