import { privateDecrypt, privateEncrypt, publicDecrypt, publicEncrypt } from "crypto";
import { AesEncryptionKeyAlgorithm } from "../../enums";
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
  encryptionKeyAlgorithm = AesEncryptionKeyAlgorithm.RSA_OAEP_256,
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

  return action(keyObject, encryptionKey);
};

export const decryptPublicEncryptionKey = ({
  publicEncryptionKey,
  key,
  encryptionKeyAlgorithm = AesEncryptionKeyAlgorithm.RSA_OAEP_256,
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

  return action(keyObject, publicEncryptionKey);
};
