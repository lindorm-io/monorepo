import { privateEncrypt, publicEncrypt } from "crypto";
import { AesAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { EncryptAesCipherOptions } from "../../types";
import { assertAesCipherSecret } from "./assert-aes-cipher-secret";
import { generateAesEncryptionKey } from "./generate-aes-encryption-key";
import { isPrivateKey } from "./is-private-key";

type EncryptionKeys = {
  encryptionKey: Buffer;
  publicEncryptionKey?: Buffer;
};

export const getAesEncryptionKeys = ({
  algorithm = AesAlgorithm.AES_256_GCM,
  key,
  secret,
}: Pick<EncryptAesCipherOptions, "algorithm" | "key" | "secret">): EncryptionKeys => {
  if (key && secret) {
    throw new AesError("Unable to encrypt AES cipher with both key and secret");
  }

  if (secret) {
    assertAesCipherSecret(secret, algorithm);

    return { encryptionKey: Buffer.from(secret) };
  }

  if (!key) {
    throw new AesError("Unable to encrypt AES cipher without key OR secret");
  }

  const encrypt = isPrivateKey(key) ? privateEncrypt : publicEncrypt;

  const encryptionKey = generateAesEncryptionKey(algorithm);
  const publicEncryptionKey = encrypt(key, encryptionKey);

  return { encryptionKey, publicEncryptionKey };
};
