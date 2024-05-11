import { CipherGCM, DecipherGCM } from "crypto";
import { AesError } from "../../errors";
import { GetAuthTagOptions, SetAuthTagOptions } from "../../types/auth-tag";
import { createHmacAuthTag, verifyHmacAuthTag } from "./auth-tag-hmac";

export const _getAuthTag = ({
  encryption: algorithm,
  cipher,
  content,
  encryptionKey,
  initialisationVector,
  integrityHash,
}: GetAuthTagOptions): Buffer | undefined => {
  switch (algorithm) {
    case "aes-128-cbc":
    case "aes-192-cbc":
    case "aes-256-cbc":
      if (!integrityHash) {
        return;
      }
      return createHmacAuthTag({
        content,
        encryptionKey,
        initialisationVector,
        integrityHash,
      });

    case "aes-128-gcm":
    case "aes-192-gcm":
    case "aes-256-gcm":
      return (cipher as CipherGCM).getAuthTag();

    default:
      throw new AesError("Unexpected algorithm");
  }
};

export const _setAuthTag = ({
  encryption: algorithm,
  authTag,
  content,
  decipher,
  decryptionKey,
  initialisationVector,
  integrityHash,
}: SetAuthTagOptions): void => {
  switch (algorithm) {
    case "aes-128-cbc":
    case "aes-192-cbc":
    case "aes-256-cbc":
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

    case "aes-128-gcm":
    case "aes-192-gcm":
    case "aes-256-gcm":
      if (!authTag) {
        throw new AesError("Auth tag is required for GCM decryption");
      }
      (decipher as DecipherGCM).setAuthTag(authTag);
      return;

    default:
      throw new AesError("Unexpected algorithm");
  }
};
