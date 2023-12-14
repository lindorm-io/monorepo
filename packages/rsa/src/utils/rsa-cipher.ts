import { privateDecrypt, privateEncrypt, publicDecrypt, publicEncrypt } from "crypto";
import { RsaFormat } from "../enums";
import { RsaError } from "../errors";
import { DecryptRsaCipherOptions, EncryptRsaCipherOptions, VerifyRsaCipherOptions } from "../types";
import { isPrivateKey } from "./private";

export const encryptRsaCipher = ({
  format = RsaFormat.BASE64,
  data,
  key,
}: EncryptRsaCipherOptions): string => {
  const action = isPrivateKey(key) ? privateEncrypt : publicEncrypt;
  return action(key, Buffer.from(data)).toString(format);
};

export const decryptRsaCipher = ({
  cipher,
  format = RsaFormat.BASE64,
  key,
}: DecryptRsaCipherOptions): string => {
  const action = isPrivateKey(key) ? privateDecrypt : publicDecrypt;
  return action(key, Buffer.from(cipher, format)).toString();
};

export const verifyRsaCipher = ({ cipher, data, format, key }: VerifyRsaCipherOptions) =>
  decryptRsaCipher({ cipher, format, key }) === data;

export const assertRsaCipher = ({ cipher, data, format, key }: VerifyRsaCipherOptions) => {
  if (verifyRsaCipher({ cipher, data, format, key })) return;
  throw new RsaError("Invalid RSA cipher");
};
