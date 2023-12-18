import { AesAlgorithm, AesEncryptionKeyAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { EncryptAesCipherOptions } from "../../types";
import { assertAesCipherSecret } from "./assert-aes-cipher-secret";
import { generateAesEncryptionKey } from "./generate-aes-encryption-key";
import { isPrivateKey } from "./is-private-key";
import { createPublicEncryptionKey } from "./public-encryption-key";

type EncryptionKeys = {
  encryptionKey: Buffer;
  isPrivateKey: boolean;
  publicEncryptionKey?: Buffer;
};

type Options = Pick<
  EncryptAesCipherOptions,
  "algorithm" | "encryptionKeyAlgorithm" | "key" | "secret"
>;

export const getAesEncryptionKeys = ({
  algorithm = AesAlgorithm.AES_256_GCM,
  key,
  encryptionKeyAlgorithm = AesEncryptionKeyAlgorithm.RSA_OAEP_256,
  secret,
}: Options): EncryptionKeys => {
  if (key && secret) {
    throw new AesError("Unable to encrypt AES cipher with both key and secret", {
      description: "Key and secret are both present",
      debug: { key, secret },
    });
  }

  if (secret) {
    assertAesCipherSecret(secret, algorithm);

    return { encryptionKey: Buffer.from(secret), isPrivateKey: false };
  }

  if (!key) {
    throw new AesError("Unable to encrypt AES cipher without key OR secret", {
      description: "Key is missing",
      debug: { key },
    });
  }

  const isPrivate = isPrivateKey(key);
  const encryptionKey = generateAesEncryptionKey(algorithm);
  const publicEncryptionKey = createPublicEncryptionKey({
    encryptionKey,
    key,
    encryptionKeyAlgorithm,
  });

  return { encryptionKey, isPrivateKey: isPrivate, publicEncryptionKey };
};
