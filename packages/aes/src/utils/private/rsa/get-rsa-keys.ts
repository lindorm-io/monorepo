import { AesAlgorithm, AesEncryptionKeyAlgorithm } from "../../../enums";
import { AesEncryptionKey } from "../../../types";
import { generateEncryptionKey } from "../generate-encryption-key";
import { getRsaPem } from "./get-rsa-pem";
import { createPublicEncryptionKey, decryptPublicEncryptionKey } from "./public-encryption-key";

type EncryptOptions = {
  algorithm: AesAlgorithm;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  key: AesEncryptionKey;
};

type EncryptResult = {
  encryptionKey: Buffer;
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
  const pem = getRsaPem(key);
  const encryptionKey = generateEncryptionKey(algorithm);
  const publicEncryptionKey = createPublicEncryptionKey({
    encryptionKey,
    pem,
    encryptionKeyAlgorithm,
  });

  return { encryptionKey, publicEncryptionKey };
};

export const getRsaDecryptionKey = ({
  encryptionKeyAlgorithm,
  key,
  publicEncryptionKey,
}: DecryptOptions): Buffer => {
  const pem = getRsaPem(key);

  return decryptPublicEncryptionKey({
    encryptionKeyAlgorithm,
    pem,
    publicEncryptionKey,
  });
};
