import { Cipher, CipherGCM, Decipher, DecipherGCM } from "crypto";
import { AesAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { AesCipherAlgorithm } from "../../types";

export const getAuthTag = (
  algorithm: AesCipherAlgorithm,
  cipher: Cipher | CipherGCM,
): Buffer | undefined => {
  switch (algorithm) {
    case AesAlgorithm.AES_128_GCM:
    case AesAlgorithm.AES_192_GCM:
    case AesAlgorithm.AES_256_GCM:
      return (cipher as CipherGCM).getAuthTag();

    default:
      return undefined;
  }
};

export const setAuthTag = (
  algorithm: AesCipherAlgorithm,
  decipher: Decipher | DecipherGCM,
  authTag?: Buffer,
): void => {
  switch (algorithm) {
    case AesAlgorithm.AES_128_GCM:
    case AesAlgorithm.AES_192_GCM:
    case AesAlgorithm.AES_256_GCM:
      if (!authTag) {
        throw new AesError("Auth tag is required for GCM decryption");
      }
      (decipher as DecipherGCM).setAuthTag(authTag);
      break;

    default:
      break;
  }
};
