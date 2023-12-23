import { CipherGCM, DecipherGCM } from "crypto";
import { AesAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { GetAuthTagOptions, SetAuthTagOptions } from "../../types/auth-tag";
import { createHmacAuthTag, verifyHmacAuthTag } from "./auth-tag-hmac";

export const getAuthTag = ({
  algorithm,
  cipher,
  content,
  encryptionKey,
  initialisationVector,
  integrityHash,
}: GetAuthTagOptions): Buffer | undefined => {
  switch (algorithm) {
    case AesAlgorithm.AES_128_CBC:
    case AesAlgorithm.AES_192_CBC:
    case AesAlgorithm.AES_256_CBC:
      if (!integrityHash) {
        return;
      }
      return createHmacAuthTag({
        content,
        encryptionKey,
        initialisationVector,
        integrityHash,
      });

    case AesAlgorithm.AES_128_GCM:
    case AesAlgorithm.AES_192_GCM:
    case AesAlgorithm.AES_256_GCM:
      return (cipher as CipherGCM).getAuthTag();

    default:
      throw new AesError("Unexpected algorithm", {
        description: "Unexpected algorithm when creating auth tag",
      });
  }
};

export const setAuthTag = ({
  algorithm,
  authTag,
  content,
  decipher,
  decryptionKey,
  initialisationVector,
  integrityHash,
}: SetAuthTagOptions): void => {
  switch (algorithm) {
    case AesAlgorithm.AES_128_CBC:
    case AesAlgorithm.AES_192_CBC:
    case AesAlgorithm.AES_256_CBC:
      if (!authTag || !integrityHash) {
        return;
      }
      verifyHmacAuthTag({
        authTag,
        content,
        encryptionKey: decryptionKey,
        initialisationVector,
        integrityHash,
      });
      return;

    case AesAlgorithm.AES_128_GCM:
    case AesAlgorithm.AES_192_GCM:
    case AesAlgorithm.AES_256_GCM:
      if (!authTag) {
        throw new AesError("Auth tag is required for GCM decryption");
      }
      (decipher as DecipherGCM).setAuthTag(authTag);
      return;

    default:
      throw new AesError("Unexpected algorithm", {
        description: "Unexpected algorithm when creating auth tag",
      });
  }
};
