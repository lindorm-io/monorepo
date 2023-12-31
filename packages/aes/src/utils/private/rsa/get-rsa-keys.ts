import { RsaKeySet } from "@lindorm-io/jwk";
import { Encryption, EncryptionKeyAlgorithm } from "../../../types";
import { generateEncryptionKey } from "./generate-encryption-key";
import { createPublicEncryptionKey, decryptPublicEncryptionKey } from "./public-encryption-key";

type EncryptOptions = {
  encryption: Encryption;
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  keySet: RsaKeySet;
};

type EncryptResult = {
  encryptionKey: Buffer;
  publicEncryptionKey: Buffer;
};

type DecryptOptions = {
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  keySet: RsaKeySet;
  publicEncryptionKey: Buffer;
};

export const getRsaEncryptionKeys = ({
  encryption,
  encryptionKeyAlgorithm,
  keySet,
}: EncryptOptions): EncryptResult => {
  const encryptionKey = generateEncryptionKey(encryption);
  const publicEncryptionKey = createPublicEncryptionKey({
    encryptionKey,
    keySet,
    encryptionKeyAlgorithm,
  });

  return { encryptionKey, publicEncryptionKey };
};

export const getRsaDecryptionKey = ({
  encryptionKeyAlgorithm,
  keySet,
  publicEncryptionKey,
}: DecryptOptions): Buffer =>
  decryptPublicEncryptionKey({
    encryptionKeyAlgorithm,
    keySet,
    publicEncryptionKey,
  });
