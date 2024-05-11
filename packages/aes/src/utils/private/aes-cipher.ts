import { AesError } from "../../errors";
import {
  DecryptAesCipherOptions,
  EncryptAesCipherOptions,
  VerifyAesCipherOptions,
} from "../../types";
import { _decryptAesData, _encryptAesData } from "./aes-data";
import { _decodeAesString } from "./decode-aes-string";
import { _encodeAesString } from "./encode-aes-string";

export const _encryptAesCipher = (options: EncryptAesCipherOptions): string =>
  _encodeAesString(_encryptAesData(options));

export const _decryptAesCipher = ({ cipher, kryptos }: DecryptAesCipherOptions): string =>
  _decryptAesData({ ..._decodeAesString(cipher), kryptos });

export const _verifyAesCipher = ({ cipher, data, kryptos }: VerifyAesCipherOptions): boolean =>
  _decryptAesCipher({ cipher, kryptos }) === data;

export const _assertAesCipher = ({ cipher, data, kryptos }: VerifyAesCipherOptions): void => {
  if (_verifyAesCipher({ cipher, data, kryptos })) return;
  throw new AesError("Invalid AES cipher");
};
