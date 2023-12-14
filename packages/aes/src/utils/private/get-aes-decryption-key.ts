import { privateDecrypt, publicDecrypt } from "crypto";
import { AesError } from "../../errors";
import { BuildAesString, DecryptAesCipherOptions } from "../../types";
import { assertAesCipherSecret } from "./assert-aes-cipher-secret";
import { isPrivateKey } from "./is-private-key";

type Options = Pick<DecryptAesCipherOptions, "key" | "secret"> &
  Pick<BuildAesString, "algorithm" | "publicEncryptionKey">;

export const getAesDecryptionKey = ({
  algorithm,
  key,
  secret,
  publicEncryptionKey,
}: Options): Buffer => {
  if (key && secret) {
    throw new AesError("Unable to decrypt AES cipher with both key and secret", {
      description: "Key and secret are both present",
      debug: { key, secret },
    });
  }

  if (secret) {
    assertAesCipherSecret(secret, algorithm);

    return Buffer.from(secret);
  }

  if (!key) {
    throw new AesError("Unable to decrypt AES cipher without key OR secret", {
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

  const decrypt = isPrivateKey(key) ? privateDecrypt : publicDecrypt;

  return decrypt(key, publicEncryptionKey);
};
