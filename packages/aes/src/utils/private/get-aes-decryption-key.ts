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
    throw new AesError("Unable to decrypt AES cipher with both key and secret");
  }

  if (secret) {
    assertAesCipherSecret(secret, algorithm);

    return Buffer.from(secret);
  }

  if (!key) {
    throw new AesError("Unable to decrypt AES cipher without key OR secret");
  }

  if (!publicEncryptionKey) {
    throw new AesError("Unable to decrypt AES cipher without public encryption key");
  }

  const decrypt = isPrivateKey(key) ? privateDecrypt : publicDecrypt;

  return decrypt(key, publicEncryptionKey);
};
