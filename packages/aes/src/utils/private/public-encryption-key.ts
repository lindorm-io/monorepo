import { privateDecrypt, privateEncrypt, publicDecrypt, publicEncrypt } from "crypto";
import { AesError } from "../../errors";
import { AesEncryptionData, DecryptAesCipherOptions, EncryptAesCipherOptions } from "../../types";
import { getKeyObject } from "./get-key-object";
import { isPrivateKey } from "./is-private-key";

type EncryptOptions = Pick<EncryptAesCipherOptions, "encryptionKeyAlgorithm" | "key"> & {
  encryptionKey: Buffer;
};

type DecryptOptions = Pick<DecryptAesCipherOptions, "key"> &
  Pick<AesEncryptionData, "encryptionKeyAlgorithm" | "publicEncryptionKey">;

export const createPublicEncryptionKey = ({
  encryptionKey,
  key,
  encryptionKeyAlgorithm,
}: EncryptOptions): Buffer => {
  if (!key) {
    throw new AesError("Unable to encrypt AES cipher without key", {
      description: "Key is missing",
      debug: { key },
    });
  }

  const isPrivate = isPrivateKey(key);
  const keyObject = isPrivate ? key : getKeyObject(key, encryptionKeyAlgorithm);
  const action = isPrivate ? privateEncrypt : publicEncrypt;

  if (isPrivate && encryptionKeyAlgorithm) {
    throw new AesError("Unexpected error when encrypting AES cipher", {
      description: "Key hash is present for private encryption",
      debug: { encryptionKeyAlgorithm },
    });
  }

  return action(keyObject, encryptionKey);
};

export const decryptPublicEncryptionKey = ({
  publicEncryptionKey,
  key,
  encryptionKeyAlgorithm,
}: DecryptOptions): Buffer => {
  if (!key) {
    throw new AesError("Unable to decrypt AES cipher without key", {
      description: "Key is missing",
      debug: { key },
    });
  }

  if (!publicEncryptionKey) {
    throw new AesError("Unable to decrypt AES cipher without public encryption key", {
      description: "Public encryption key is missing",
      debug: { publicEncryptionKey },
    });
  }

  const isPrivate = isPrivateKey(key);
  const keyObject = isPrivate ? getKeyObject(key, encryptionKeyAlgorithm) : key;
  const action = isPrivate ? privateDecrypt : publicDecrypt;

  if (isPrivate && !encryptionKeyAlgorithm) {
    throw new AesError("Unexpected error when decrypting AES cipher", {
      description: "Key hash is missing for private decryption",
    });
  }

  return action(keyObject, publicEncryptionKey);
};
