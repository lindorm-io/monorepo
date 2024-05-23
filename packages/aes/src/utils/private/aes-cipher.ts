import { AesError } from "../../errors";
import {
  DecryptAesCipherOptions,
  EncryptAesCipherOptions,
  VerifyAesCipherOptions,
} from "../../types";
import { decryptAesData, encryptAesData } from "./aes-data";
import { decodeAesString } from "./decode-aes-string";
import { encodeAesString } from "./encode-aes-string";

export const encryptAesCipher = (options: EncryptAesCipherOptions): string =>
  encodeAesString(encryptAesData(options));

export const decryptAesCipher = ({ cipher, kryptos }: DecryptAesCipherOptions): string =>
  decryptAesData({ ...decodeAesString(cipher), kryptos });

export const verifyAesCipher = ({
  cipher,
  data,
  kryptos,
}: VerifyAesCipherOptions): boolean => decryptAesCipher({ cipher, kryptos }) === data;

export const assertAesCipher = ({
  cipher,
  data,
  kryptos,
}: VerifyAesCipherOptions): void => {
  if (verifyAesCipher({ cipher, data, kryptos })) return;
  throw new AesError("Invalid AES cipher");
};
