import { AesError } from "../../errors";
import { AesEncryptionData, DecryptAesCipherOptions } from "../../types";
import { assertAesCipherSecret } from "./assert-aes-cipher-secret";
import { decryptPublicEncryptionKey } from "./public-encryption-key";

type Options = Pick<DecryptAesCipherOptions, "key" | "secret"> &
  Pick<AesEncryptionData, "algorithm" | "keyHash" | "publicEncryptionKey">;

export const getAesDecryptionKey = ({
  algorithm,
  key,
  keyHash,
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

  return decryptPublicEncryptionKey({ key, keyHash, publicEncryptionKey });
};
