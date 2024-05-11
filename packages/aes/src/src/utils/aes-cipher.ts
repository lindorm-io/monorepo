import { AesError } from "../errors";
import { DecryptAesCipherOptions, EncryptAesCipherOptions, VerifyAesCipherOptions } from "../types";
import { decryptAesData, encryptAesData } from "./aes-data";
import { _decodeAesString } from "./private/decode-aes-string";
import { _encodeAesString } from "./private/encode-aes-string";

export const encryptAesCipher = (options: EncryptAesCipherOptions): string =>
  _encodeAesString(encryptAesData(options));

export const decryptAesCipher = ({ cipher, kryptos }: DecryptAesCipherOptions): string =>
  decryptAesData({ ..._decodeAesString(cipher), kryptos });

export const verifyAesCipher = ({ cipher, data, kryptos }: VerifyAesCipherOptions): boolean =>
  decryptAesCipher({ cipher, kryptos }) === data;

export const assertAesCipher = ({ cipher, data, kryptos }: VerifyAesCipherOptions): void => {
  if (verifyAesCipher({ cipher, data, kryptos })) return;
  throw new AesError("Invalid AES cipher");
};
