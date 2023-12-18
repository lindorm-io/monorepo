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
}: GetAuthTagOptions): Buffer | undefined => {
  switch (algorithm) {
    case AesAlgorithm.AES_128_CBC:
    case AesAlgorithm.AES_192_CBC:
    case AesAlgorithm.AES_256_CBC:
      return;

    case AesAlgorithm.AES_128_CBC_HS256:
    case AesAlgorithm.AES_192_CBC_HS256:
    case AesAlgorithm.AES_256_CBC_HS256:
      return createHmacAuthTag({ content, encryptionKey, initialisationVector });

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
}: SetAuthTagOptions): void => {
  switch (algorithm) {
    case AesAlgorithm.AES_128_CBC:
    case AesAlgorithm.AES_192_CBC:
    case AesAlgorithm.AES_256_CBC:
      break;

    case AesAlgorithm.AES_128_CBC_HS256:
    case AesAlgorithm.AES_192_CBC_HS256:
    case AesAlgorithm.AES_256_CBC_HS256:
      if (!authTag) {
        throw new AesError("Auth tag is required for CBC decryption");
      }
      verifyHmacAuthTag({
        authTag,
        content,
        encryptionKey: decryptionKey,
        initialisationVector,
      });
      break;

    case AesAlgorithm.AES_128_GCM:
    case AesAlgorithm.AES_192_GCM:
    case AesAlgorithm.AES_256_GCM:
      if (!authTag) {
        throw new AesError("Auth tag is required for GCM decryption");
      }
      (decipher as DecipherGCM).setAuthTag(authTag);
      break;

    default:
      throw new AesError("Unexpected algorithm", {
        description: "Unexpected algorithm when creating auth tag",
      });
  }
};
