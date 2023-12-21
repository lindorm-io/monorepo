import { AesError } from "../errors";
import { DecryptAesCipherOptions, EncryptAesCipherOptions, VerifyAesCipherOptions } from "../types";
import { decryptAesData, encryptAesData } from "./aes-data";
import { decodeAesString, encodeAesString } from "./private";

export const encryptAesCipher = (options: EncryptAesCipherOptions): string =>
  encodeAesString(encryptAesData(options));

export const decryptAesCipher = ({ cipher, key, secret }: DecryptAesCipherOptions): string =>
  decryptAesData({ ...decodeAesString(cipher), key, secret });

export const verifyAesCipher = ({ cipher, data, key, secret }: VerifyAesCipherOptions): boolean =>
  decryptAesCipher({ cipher, key, secret }) === data;

export const assertAesCipher = ({ cipher, data, key, secret }: VerifyAesCipherOptions): void => {
  if (verifyAesCipher({ cipher, data, key, secret })) return;
  throw new AesError("Invalid AES cipher");
};
