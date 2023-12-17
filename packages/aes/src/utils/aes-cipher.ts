import { AesError } from "../errors";
import { DecryptAesCipherOptions, EncryptAesCipherOptions, VerifyAesCipherOptions } from "../types";
import { decryptAesData, encryptAesData } from "./aes-data";
import { decodeAesString } from "./decode-aes-string";
import { encodeAesString } from "./private/encode-aes-string";

export const encryptAesCipher = (options: EncryptAesCipherOptions): string =>
  encodeAesString(encryptAesData(options));

export const decryptAesCipher = ({ cipher, key, secret }: DecryptAesCipherOptions): string => {
  const { algorithm, authTag, encryption, keyHash, publicEncryptionKey, initialisationVector } =
    decodeAesString(cipher);

  return decryptAesData({
    algorithm,
    authTag,
    encryption,
    initialisationVector,
    key,
    keyHash,
    publicEncryptionKey,
    secret,
  });
};

export const verifyAesCipher = ({ cipher, data, key, secret }: VerifyAesCipherOptions): boolean =>
  decryptAesCipher({ cipher, key, secret }) === data;

export const assertAesCipher = ({ cipher, data, key, secret }: VerifyAesCipherOptions): void => {
  if (verifyAesCipher({ cipher, data, key, secret })) return;
  throw new AesError("Invalid AES cipher");
};
