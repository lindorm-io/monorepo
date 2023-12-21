import { privateDecrypt, privateEncrypt, publicDecrypt, publicEncrypt } from "crypto";
import { AesEncryptionKeyAlgorithm } from "../../../enums";
import { AesError } from "../../../errors";
import { AesEncryptionKey } from "../../../types";
import { isPrivateKey } from "../is-private-key";
import { getRsaKeyObject } from "./get-rsa-key-object";

type EncryptOptions = {
  encryptionKey: Buffer;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  key: AesEncryptionKey;
};

type DecryptOptions = {
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  key: AesEncryptionKey;
  publicEncryptionKey: Buffer;
};

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

  if (!isPrivate && !encryptionKeyAlgorithm) {
    throw new AesError(
      "Unable to encrypt AES cipher with public key without encryption key algorithm",
      {
        description: "Encryption key algorithm is missing",
        debug: { encryptionKeyAlgorithm },
      },
    );
  }

  const { type, ...rest } = key;
  const keyObject = isPrivate ? rest : getRsaKeyObject(key, encryptionKeyAlgorithm!);
  const action = isPrivate ? privateEncrypt : publicEncrypt;

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

  if (isPrivate && !encryptionKeyAlgorithm) {
    throw new AesError(
      "Unable to decrypt AES cipher with private key without encryption key algorithm",
      {
        description: "Encryption key algorithm is missing",
        debug: { encryptionKeyAlgorithm },
      },
    );
  }

  const { type, ...rest } = key;
  const keyObject = isPrivate ? getRsaKeyObject(key, encryptionKeyAlgorithm!) : rest;
  const action = isPrivate ? privateDecrypt : publicDecrypt;

  return action(keyObject, publicEncryptionKey);
};
