import { AesAlgorithm, AesEncryptionKeyAlgorithm } from "../../../enums";
import { AesEncryptionKey } from "../../../types";
import { generateEncryptionKey } from "../generate-encryption-key";
import { isPrivateKey } from "../is-private-key";
import { createPublicEncryptionKey, decryptPublicEncryptionKey } from "./public-encryption-key";

type EncryptOptions = {
  algorithm: AesAlgorithm;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  key: AesEncryptionKey;
};

type EncryptResult = {
  encryptionKey: Buffer;
  isPrivateKey: boolean;
  publicEncryptionKey: Buffer;
};

type DecryptOptions = {
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  key: AesEncryptionKey;
  publicEncryptionKey: Buffer;
};

export const getRsaEncryptionKeys = ({
  algorithm,
  encryptionKeyAlgorithm,
  key,
}: EncryptOptions): EncryptResult => {
  const isPrivate = isPrivateKey(key);
  const encryptionKey = generateEncryptionKey(algorithm);
  const publicEncryptionKey = createPublicEncryptionKey({
    encryptionKey,
    key,
    encryptionKeyAlgorithm,
  });

  return { encryptionKey, isPrivateKey: isPrivate, publicEncryptionKey };
};

export const getRsaDecryptionKey = (options: DecryptOptions): Buffer =>
  decryptPublicEncryptionKey(options);
